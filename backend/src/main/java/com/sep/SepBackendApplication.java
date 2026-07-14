package com.sep;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SepBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(SepBackendApplication.class, args);
	}

}

