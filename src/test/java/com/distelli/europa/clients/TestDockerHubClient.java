package com.distelli.europa.clients;

import org.junit.Ignore;
import org.junit.Test;
import org.junit.Before;
import javax.inject.Inject;
import javax.inject.Provider;
import com.google.inject.Guice;
import com.distelli.europa.EuropaTestModule;
import com.distelli.europa.EuropaTestConfig;
import com.distelli.persistence.PageIterator;
import com.distelli.europa.models.DockerHubRepository;
import com.distelli.europa.models.DockerHubRepoTag;

public class TestDockerHubClient {
    @Inject
    private EuropaTestConfig testConfig;

    @Inject
    private Provider<DockerHubClient.Builder> _dhClientBuilderProvider;

    @Before
    public void before() {
        Guice.createInjector(new EuropaTestModule())
            .injectMembers(this);
    }
    @Ignore("replace with a test that actually tests something")
    @Test
    public void testListRepositories() throws Exception {
        DockerHubClient client = _dhClientBuilderProvider.get()
            .credentials(
                testConfig.getDockerHubUsername(),
                testConfig.getDockerHubPassword())
            .build();

        DockerHubRepository firstRepo = null;
        int count = 0;
        System.out.println("Repositories:");
        for ( PageIterator iter : new PageIterator().pageSize(3) ) {
            for ( DockerHubRepository repo : client.listRepositories(testConfig.getDockerHubUsername(), iter) ) {
                if ( null == firstRepo ) firstRepo = repo;
                System.out.println("\t- "+repo);
            }
            System.out.println("\t-----");
            if ( ++count >= 3 ) break;
        }
        count = 0;
        System.out.println("Tags: (for "+firstRepo+")");
        for ( PageIterator iter : new PageIterator().pageSize(3) ) {
            for ( DockerHubRepoTag tag : client.listRepoTags(firstRepo, iter) ) {
                System.out.println("\t- "+tag);
            }
            System.out.println("\t-----");
            if ( ++count >= 3 ) break;
        }
    }
}
