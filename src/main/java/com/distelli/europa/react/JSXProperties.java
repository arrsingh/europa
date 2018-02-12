package com.distelli.europa.react;

import com.distelli.europa.EuropaVersion;
import com.distelli.europa.models.DnsSettings;
import com.distelli.webserver.RequestContext;
import lombok.extern.log4j.Log4j;

@Log4j
public class JSXProperties
{
    private RequestContext _requestContext;
    private DnsSettings _dnsSettings;

    public JSXProperties(RequestContext requestContext) {
        _requestContext = requestContext;
    }
    public JSXProperties(RequestContext requestContext, DnsSettings dnsSettings)
    {
        _requestContext = requestContext;
        _dnsSettings = dnsSettings;
    }

    public String getDnsName()
    {
        if(_dnsSettings == null)
            return null;
        return _dnsSettings.getDnsName();
    }

    public String getEuropa()
    {
        return "community";
    }

    public String getVersion()
    {
        return EuropaVersion.VERSION;
    }
}
