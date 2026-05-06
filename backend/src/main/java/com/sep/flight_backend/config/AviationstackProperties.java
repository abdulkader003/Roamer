package com.sep.flight_backend.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.AssertTrue;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "external.aviationstack")
public class AviationstackProperties {
    @NotBlank(message = "AVIATIONSTACK_ACCESS_KEY is required")
    private String accessKey;

    @NotBlank
    private String baseUrl;

    public String getAccessKey() {
        return accessKey;
    }

    public void setAccessKey(String accessKey) {
        this.accessKey = accessKey;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    @AssertTrue(message = "AVIATIONSTACK_ACCESS_KEY must be set to a real key, not a placeholder")
    public boolean isAccessKeyResolved() {
        return accessKey != null
                && !accessKey.isBlank()
                && !accessKey.contains("${")
                && !accessKey.contains("your_key_here");
    }
}
