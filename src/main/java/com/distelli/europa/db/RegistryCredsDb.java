/*
  $Id: $
  @file RegistryCredsDb.java
  @brief Contains the RegistryCredsDb.java class

  @author Rahul Singh [rsingh]
  Copyright (c) 2013, Distelli Inc., All Rights Reserved.
*/
package com.distelli.europa.db;

import java.util.List;
import com.distelli.persistence.ConvertMarker;
import com.distelli.persistence.Index;
import com.distelli.persistence.Index;
import com.distelli.persistence.PageIterator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.distelli.jackson.transform.TransformModule;

import com.distelli.europa.models.*;
import org.apache.log4j.Logger;
import javax.inject.Inject;
import com.google.inject.Singleton;

@Singleton
public class RegistryCredsDb
{
    private static final Logger log = Logger.getLogger(RegistryCredsDb.class);

    private Index<RegistryCred> _main;

    private static final ObjectMapper om = new ObjectMapper();
    private static TransformModule createTransforms(TransformModule module) {
        module.createTransform(RegistryCred.class)
        .put("hk", String.class,
             (item) -> getHashKey(item))
        .put("rk", String.class,
             (item) -> getRangeKey(item.getProvider(), item.getRegion()))
        .put("ctime", Long.class, "created")
        .put("kid", String.class, "key")
        .put("sec", String.class, "secret")
        .put("region", String.class, "region")
        .put("desc", String.class, "description")
        .put("rp", RegistryProvider.class, "provider");
        return module;
    }

    @Inject
    protected RegistryCredsDb(Index.Factory indexFactory, ConvertMarker.Factory convertMarkerFactory) {
        om.registerModule(createTransforms(new TransformModule()));
        _main = indexFactory.create(RegistryCred.class)
        .withTableName("creds")
        .withNoEncrypt("hk", "rk")
        .withHashKeyName("hk")
        .withRangeKeyName("rk")
        .withConvertValue(om::convertValue)
        .withConvertMarker(convertMarkerFactory.create("hk", "rk"))
        .build();
    }

    private static final String getHashKey(RegistryCred cred)
    {
        return "1";
    }

    private static final String getRangeKey(RegistryProvider provider, String region)
    {
        return String.format("%s:%s",
                             provider.toString().toLowerCase(),
                             region.toString().toLowerCase());
    }

    public void save(RegistryCred cred)
    {
        String region = cred.getRegion();
        if(region == null || region.contains(":"))
            throw(new IllegalArgumentException("Invalid Region "+region+" in Registry Cred"));
        _main.putItem(cred);
    }

    public List<RegistryCred> listAllCreds(PageIterator pageIterator)
    {
        return _main.queryItems(getHashKey(null), pageIterator).list();
    }

    public List<RegistryCred> listCredsForProvider(RegistryProvider provider, PageIterator pageIterator)
    {
        String rangeKey = String.format("%s:", provider.toString().toLowerCase());
        return _main.queryItems(getHashKey(null), pageIterator)
        .beginsWith(rangeKey)
        .list();
    }

    public RegistryCred getCred(RegistryProvider provider, String region)
    {
        return _main.getItem(getHashKey(null),
                             getRangeKey(provider, region));
    }

    public void deleteCred(RegistryProvider provider, String region)
    {
        _main.deleteItem(getHashKey(null),
                         getRangeKey(provider, region));
    }
}
