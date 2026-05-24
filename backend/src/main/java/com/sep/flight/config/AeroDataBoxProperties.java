package com.sep.flight.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "external.aerodatabox")
public class AeroDataBoxProperties {
    @NotBlank(message = "AERODATABOX_RAPIDAPI_KEY is required")
    private String rapidapiKey;

    @NotBlank
    private String rapidapiHost;

    @NotBlank
    private String baseUrl;

    public String getRapidapiKey() {
        return rapidapiKey;
    }

    public void setRapidapiKey(String rapidapiKey) {
        this.rapidapiKey = rapidapiKey;
    }

    public String getRapidapiHost() {
        return rapidapiHost;
    }

    public void setRapidapiHost(String rapidapiHost) {
        this.rapidapiHost = rapidapiHost;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    @AssertTrue(message = "AERODATABOX_RAPIDAPI_KEY must be set to a real key, not a placeholder")
    public boolean isRapidapiKeyResolved() {
        return rapidapiKey != null
                && !rapidapiKey.isBlank()
                && !rapidapiKey.contains("${")
                && !rapidapiKey.contains("your_key_here");
    }
}
