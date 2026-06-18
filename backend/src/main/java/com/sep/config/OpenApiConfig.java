package com.sep.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI configuration for the ROAMER backend.
 *
 * <p>This configuration enables Swagger UI documentation and JWT bearer
 * authentication support for protected endpoints.</p>
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI roamerOpenAPI() {
        final String securitySchemeName = "bearerAuth";

        return new OpenAPI()
                .info(new Info()
                        .title("ROAMER API")
                        .description("API documentation for the ROAMER travel management platform.")
                        .version("v0.4.0")
                        .contact(new Contact()
                                .name("team-lovelace-notation"))
                        .license(new License()
                                .name("SEP Project")))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName,
                                new SecurityScheme()
                                        .name(securitySchemeName)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")));
    }
}