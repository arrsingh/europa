package com.distelli.europa.db;

import com.distelli.europa.models.ContainerRepo;
import com.distelli.europa.models.DockerImage;
import com.distelli.europa.models.Monitor;
import com.distelli.europa.models.MultiTaggedManifest;
import com.distelli.europa.models.Notification;
import com.distelli.europa.models.NotificationId;
import com.distelli.europa.models.Pipeline;
import com.distelli.europa.models.RegistryManifest;
import com.distelli.europa.models.RepoEvent;
import com.distelli.europa.models.RepoEventType;
import com.distelli.europa.models.UnknownDigests;
import com.distelli.europa.notifiers.Notifier;
import com.distelli.europa.tasks.PipelineTask;
import com.distelli.europa.util.Tag;
import com.distelli.jackson.transform.TransformModule;
import com.distelli.persistence.AttrType;
import com.distelli.persistence.Attribute;
import com.distelli.persistence.ConvertMarker;
import com.distelli.persistence.Index;
import com.distelli.persistence.IndexDescription;
import com.distelli.persistence.IndexType;
import com.distelli.persistence.PageIterator;
import com.distelli.persistence.TableDescription;
import com.distelli.utils.CompositeKey;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.log4j.Log4j;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.persistence.RollbackException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Log4j
@Singleton
public class RegistryManifestDb extends BaseDb {
    private static final String TABLE_NAME = "rmanifest";

    private Index<RegistryManifest> _main;
    private Index<RegistryManifest> _byRepoManifestId;

    private final ObjectMapper _om = new ObjectMapper();

    @Inject
    private RegistryBlobDb _blobDb;
    @Inject
    private TasksDb _tasksDb;
    @Inject
    private Monitor _monitor;
    @Inject
    private RepoEventsDb _eventsDb;
    @Inject
    private PipelineDb _pipelineDb;
    @Inject
    private ContainerRepoDb _repoDb;
    @Inject
    protected NotificationsDb _notificationDb = null;
    @Inject
    protected Notifier _notifier = null;

    public static TableDescription getTableDescription() {
        return TableDescription.builder()
            .tableName(TABLE_NAME)
            .indexes(
                Arrays.asList(
                    IndexDescription.builder()
                    .hashKey(attr("dom", AttrType.STR))
                    .rangeKey(attr("rk", AttrType.STR))
                    .indexType(IndexType.MAIN_INDEX)
                    .readCapacity(1L)
                    .writeCapacity(1L)
                    .build(),
                    IndexDescription.builder()
                    .indexName("dom-rmid-index")
                    .hashKey(attr("dom", AttrType.STR))
                    .rangeKey(attr("rmid", AttrType.STR))
                    .indexType(IndexType.GLOBAL_SECONDARY_INDEX)
                    .readCapacity(1L)
                    .writeCapacity(1L)
                    .build()))
            .build();
    }

    private TransformModule createTransforms(TransformModule module) {
        module.createTransform(RegistryManifest.class)
            .put("dom", String.class, "domain")
            .put("rk", String.class, (manifest) -> toRK(manifest.getContainerRepoId(), manifest.getTag()))
            .put("repo", String.class, "containerRepoId")
            .put("tag", String.class, "tag")
            .put("id", String.class, "manifestId")
            .put("rmid", String.class, (manifest) -> toRepoManifestIdRK(manifest.getContainerRepoId(), manifest.getManifestId()))
            .put("mds", new TypeReference<Set<String>>(){}, "digests")
            .put("by", String.class, "uploadedBy")
            .put("ty", String.class, "contentType")
            .put("vsz", Long.class, "virtualSize")
            .put("ts", Long.class, "pushTime");
        return module;
    }

    private String toRK(String repoId, String tag) {
        if ( null == repoId ) throw new NullPointerException("containerRepoId can not be null");
        if ( null == tag ) throw new NullPointerException("tag can not be null");
        return CompositeKey.build(repoId, tag);
    }

    private String toRepoManifestIdRK(String repoId, String manifestId)
    {
        if(manifestId == null || manifestId.trim().isEmpty())
            manifestId = "";
        return CompositeKey.build(repoId.toLowerCase(),
                                  manifestId.toLowerCase());
    }

    @Inject
    protected RegistryManifestDb(Index.Factory indexFactory,
                                 ConvertMarker.Factory convertMarkerFactory) {
        _om.registerModule(createTransforms(new TransformModule()));

        _main = indexFactory.create(RegistryManifest.class)
            .withTableDescription(getTableDescription())
            .withConvertValue(_om::convertValue)
            // Custom convert marker implementation to support tag pagination:
            .withConvertMarker(new ConvertMarker() {
                    public String toMarker(Map<String, Object> attributes, boolean hasHashKey) {
                        if ( hasHashKey ) {
                            return (String)attributes.get("rk");
                        }
                        throw new UnsupportedOperationException("scan is not supported");
                    }
                    public Attribute[] fromMarker(Object hk, String marker) {
                        if ( null == hk ) {
                            throw new UnsupportedOperationException("scan is not supported");
                        }
                        return new Attribute[] {
                            new Attribute()
                            .withName("dom")
                            .withValue(hk),
                            new Attribute()
                            .withName("rk")
                            .withValue(marker)
                        };
                    }
                })
            .build();

        _byRepoManifestId = indexFactory.create(RegistryManifest.class)
        .withTableDescription(getTableDescription(), "dom-rmid-index")
        .withConvertValue(_om::convertValue)
        .build();
    }

    /**
     * Overwrites with a new registry manifest, potentially
     */
    public RegistryManifest put(RegistryManifest manifest) throws UnknownDigests {
        if ( null == manifest.getDomain() || manifest.getDomain().isEmpty()) {
            throw new IllegalArgumentException("domain is required parameter");
        }
        // Validate uploadedBy:
        if ( null == manifest.getUploadedBy() || manifest.getUploadedBy().isEmpty() ) {
            throw new IllegalArgumentException("uploadedBy is required parameter");
        }
        if ( null == manifest.getContainerRepoId() || manifest.getContainerRepoId().isEmpty() ) {
            throw new IllegalArgumentException("containerRepoId is required parameter");
        }
        if ( null == manifest.getTag() || manifest.getTag().isEmpty() ) {
            throw new IllegalArgumentException("tag is required parameter");
        }
        if ( null == manifest.getContentType() || ! manifest.getContentType().matches("^[^/]{1,127}/[^/]{1,127}$") ) {
            throw new IllegalArgumentException(
                "Illegal contentType="+manifest.getContentType()+" expected to match [^/]{1,127}/[^/]{1,127}");
        }

        String manifestId = manifest.getManifestId();
        if ( null == manifestId || ! Tag.isDigest(manifestId) ) {
            throw new IllegalArgumentException(
                "Illegal manifestId="+manifestId+" expected to match sha256:[0-9a-f]{64}");
        }

        // Validate digests (and add references):
        Set<String> digests = manifest.getDigests();
        if ( null == digests ) digests = Collections.emptySet();
        Set<String> unknownDigests = new HashSet<>();
        if ( ! digests.isEmpty() ) {
            long totalSize = 0;
            for ( String digest : digests ) {
                Long size = _blobDb.addReference(digest, manifestId);
                if ( null == size ) {
                    unknownDigests.add(digest);
                } else {
                    totalSize += size;
                }
            }
            manifest.setVirtualSize(totalSize);
        }
        if ( ! unknownDigests.isEmpty() ) {
            for ( String digest : digests ) {
                if ( ! unknownDigests.contains(digest) ) {
                    _blobDb.removeReference(digest, manifestId);
                }
            }
            throw new UnknownDigests(
                "DigestsUnknown "+unknownDigests+" referenced by "+manifest,
                unknownDigests);
        }

        boolean success = false;
        RegistryManifest old = null;
        try {
            // There should always be an entry for the manifestId-as-tag.
            if ((! Tag.isDigest(manifest.getTag()))
                && null == getManifestByRepoIdTag(manifest.getDomain(),
                                                  manifest.getContainerRepoId(),
                                                  manifestId)) {
                RegistryManifest copy = manifest.toBuilder()
                    .tag(manifestId)
                    .build();
                _main.putItem(copy);
            }
            old = _main.putItem(manifest);

            if ( ! Tag.isDigest(manifest.getTag()) ) {
                RepoEvent event = RepoEvent.builder()
                    .domain(manifest.getDomain())
                    .repoId(manifest.getContainerRepoId())
                    .eventType(RepoEventType.PUSH)
                    .eventTime(System.currentTimeMillis())
                    .imageTags(Collections.singletonList(manifest.getTag()))
                    .imageSha(manifest.getManifestId())
                    .build();
                _eventsDb.save(event);
                _repoDb.setLastEvent(event.getDomain(), event.getRepoId(), event);

                DockerImage image = DockerImage
                    .builder()
                    .imageTags(event.getImageTags())
                    .pushTime(manifest.getPushTime())
                    .imageSha(manifest.getManifestId())
                    .build();

                notify(manifest, image, event);

                if(log.isDebugEnabled())
                    log.debug(
                        "Finding pipelines to execute for domain="+manifest.getDomain()+
                        " repoId="+manifest.getContainerRepoId());
                for ( PageIterator it : new PageIterator() ) {
                    for ( Pipeline pipeline : _pipelineDb.listByContainerRepoId(
                              manifest.getDomain(),
                              manifest.getContainerRepoId(),
                              it) )
                    {
                        if(log.isDebugEnabled())
                            log.debug("Adding Pipeline task for id: "+pipeline.getId());
                        _tasksDb.addTask(_monitor,
                                         PipelineTask.builder()
                                         .domain(manifest.getDomain())
                                         .tag(manifest.getTag())
                                         .containerRepoId(manifest.getContainerRepoId())
                                         .manifestId(manifest.getManifestId())
                                         .pipelineId(pipeline.getId())
                                         .build());
                    }
                }
            }
            if ( null != old && null != old.getDigests() && null != old.getManifestId() ) {
                // clean-up references:
                for ( String digest : old.getDigests() ) {
                    _blobDb.removeReference(digest, old.getManifestId());
                }
            }
            success = true;
        } finally {
            if ( ! success ) {
                for ( String digest : digests ) {
                    _blobDb.removeReference(digest, manifestId);
                }
            }
        }
        return old;
    }

    public void remove(String domain, String repoId, String tag) {
        if ( null == domain ) domain = "d0";

        RegistryManifest manifest = null;
        while ( true ) {
            manifest = _main.getItem(domain, toRK(repoId, tag));
            if ( null == manifest ) return;

            try {
                String manifestId = manifest.getManifestId();
                _main.deleteItem(domain, toRK(repoId, tag),
                                 (expr) -> expr.eq("id", manifestId));
            } catch ( RollbackException ex ) {
                continue;
            }
            break;
        }
        String deletedManifestId = manifest.getManifestId();
        manifest.setManifestId(null);

        if ( ! Tag.isDigest(tag) ) {
            RepoEvent event = RepoEvent.builder()
                .domain(manifest.getDomain())
                .repoId(manifest.getContainerRepoId())
                .eventType(RepoEventType.DELETE)
                .eventTime(System.currentTimeMillis())
                .imageTags(Collections.singletonList(manifest.getTag()))
                .imageSha(manifest.getManifestId())
                .build();
            _eventsDb.save(event);
            _repoDb.setLastEvent(event.getDomain(), event.getRepoId(), event);

            DockerImage image = DockerImage.builder()
                .imageTags(event.getImageTags())
                .pushTime(manifest.getPushTime())
                .imageSha(manifest.getManifestId())
                .build();

            notify(manifest, image, event);

            if(log.isDebugEnabled())
                log.debug(
                    "Finding pipelines to execute for domain="+manifest.getDomain()+
                    " repoId="+manifest.getContainerRepoId());
            for ( PageIterator it : new PageIterator() ) {
                for ( Pipeline pipeline : _pipelineDb.listByContainerRepoId(
                          manifest.getDomain(),
                          manifest.getContainerRepoId(),
                          it) )
                {
                    if(log.isDebugEnabled())
                        log.debug("Adding Pipeline task for id: "+pipeline.getId());
                    _tasksDb.addTask(_monitor,
                                     PipelineTask.builder()
                                     .domain(manifest.getDomain())
                                     .tag(manifest.getTag())
                                     .containerRepoId(manifest.getContainerRepoId())
                                     .manifestId(manifest.getManifestId())
                                     .pipelineId(pipeline.getId())
                                     .build());
                }
            }
        }

        // clean-up references:
        for ( String digest : manifest.getDigests() ) {
            _blobDb.removeReference(digest, deletedManifestId);
        }

    }

    public RegistryManifest getManifestByRepoIdTag(String domain, String repoId, String tag) {
        if ( null == domain ) domain = "d0";
        return _main.getItem(domain, toRK(repoId, tag));
    }

    public List<RegistryManifest> listManifestsByRepoId(String domain, String repoId, PageIterator iterator) {
        if ( null == domain ) domain = "d0";

        String beginsWith = toRK(repoId, "");
        String marker = iterator.getMarker();
        String newMarker = null;
        if ( null != marker ) {
            newMarker = toRK(repoId, marker);
            iterator.marker(newMarker);
        }
        try {
            return _main.queryItems(domain, iterator)
                .beginsWith(beginsWith)
                .list();
        } finally {
            String finalMarker = iterator.getMarker();
            if ( null != finalMarker ) {
                if ( finalMarker.equals(newMarker) ) {
                    // Restore!
                    iterator.marker(marker);
                } else if ( finalMarker.startsWith(beginsWith) ) {
                    iterator.marker(finalMarker.substring(beginsWith.length()));
                } else {
                    throw new IllegalStateException(
                        "Expected marker to begin with "+beginsWith+", but got "+finalMarker);
                }
            }
        }
    }

    public List<MultiTaggedManifest> listMultiTaggedManifest(String domain, String repoId, PageIterator outerIter) {
        // Maybe we should throw an exception?
        if ( outerIter.getPageSize() <= 0 ) {
            return Collections.emptyList();
        }

        List<MultiTaggedManifest> result = new ArrayList<>();
        MultiTaggedManifest multiManifest = null;
        RegistryManifest lastManifest = null;
        RegistryManifest firstManifest = null;

        // We do page size 2x since we KNOW every manifest will have at least
        // a sha256 entry and possibly one or more tag entries. Ideally we only
        // do a single iteration of the outer loop.
        boolean isFirst = true;
        for ( PageIterator iter : new PageIterator()
                  .pageSize(outerIter.getPageSize()*2)
                  .marker(outerIter.getMarker())
                  .setIsForward(outerIter.isForward()) )
        {
            for ( RegistryManifest manifest : _byRepoManifestId.queryItems(domain.toLowerCase(), iter)
                      .beginsWith(toRepoManifestIdRK(repoId, null))
                      .list() )
            {
                if ( isFirst ) {
                    outerIter.setPrevMarker(iter.getPrevMarker());
                    isFirst = false;
                }
                // Update firstManifest:
                if ( null == firstManifest ) firstManifest = manifest;

                if ( null == multiManifest ||
                     ! multiManifest.getManifestId().equals(manifest.getManifestId()) )
                {
                    if ( result.size() >= outerIter.getPageSize() ) {
                        // Result set is full:
                        outerIter.setMarker(_byRepoManifestId.toMarker(lastManifest, true));
                        return result;
                    }
                    // Add new MultiTaggedManifest:
                    multiManifest = MultiTaggedManifest.fromRegistryManifest(manifest);
                    result.add(multiManifest);
                } else if ( null != manifest.getTag() ) {
                    // Add tag to MultiTaggedManifest:
                    multiManifest.addTag(manifest.getTag());
                }
                // Update lastManifest
                lastManifest = manifest;
            }
        }
        // No more results:
        outerIter.setMarker(null);
        return result;
    }

    private void notify(RegistryManifest manifest, DockerImage image, RepoEvent event)
    {
        try {
            ContainerRepo repo = null;
            //first get the list of notifications.
            //for each notification call the notifier
            List<Notification> notifications = _notificationDb.listNotifications(manifest.getDomain(),
                                                                                 manifest.getContainerRepoId(),
                                                                                 new PageIterator().pageSize(100));
            List<String> nfIdList = new ArrayList<String>();
            for(Notification notification : notifications)
            {
                if ( null == repo ) {
                    repo = _repoDb.getRepo(manifest.getDomain(), manifest.getContainerRepoId());
                    if ( null == repo ) {
                        log.error("Manifest references null ContainerRepo domain="+manifest.getDomain()+
                                  " repoId="+manifest.getContainerRepoId());
                        break;
                    }
                }
                if(log.isDebugEnabled())
                    log.debug("Triggering Notification: "+notification+" for Image: "+image+" and Event: "+event);
                NotificationId nfId = _notifier.notify(notification, image, repo);
                if(nfId != null)
                    nfIdList.add(nfId.toCanonicalId());
            }
            _eventsDb.setNotifications(event.getDomain(), event.getRepoId(), event.getId(), nfIdList);
            event.setNotifications(nfIdList);
        } catch(Throwable t) {
            log.error(t.getMessage(), t);
        }
    }
}
