package com.sep;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.SpringApplication;
import org.mockito.MockedStatic;

import static org.mockito.Mockito.mockStatic;

@SpringBootTest
class SepBackendApplicationTests {

	@Test
	void contextLoads() {
	}

	@Test
	void mainDelegatesToSpringApplicationRun() {
		try (MockedStatic<SpringApplication> springApplication = mockStatic(SpringApplication.class)) {
			SepBackendApplication.main(new String[0]);

			springApplication.verify(() -> SpringApplication.run(SepBackendApplication.class, new String[0]));
		}
	}

}
