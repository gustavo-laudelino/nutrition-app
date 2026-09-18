package com.nutritionapp;

import java.util.ArrayList;
import java.util.Arrays;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;
import org.springframework.context.annotation.Profile;

/**
 * Runs Flyway explicitly: Boot 4's Flyway auto-configuration lives in a separate module
 * that is not an authorized dependency. Migration waits for a valid JWT key and runs before JPA validation.
 */
@Configuration
@Profile("!test")
public class DatabaseMigrationConfiguration {
    @Bean(initMethod = "migrate")
    @DependsOn("jwtKey")
    Flyway flyway(DataSource dataSource,
                  @Value("${spring.flyway.baseline-on-migrate}") boolean baselineOnMigrate,
                  @Value("${spring.flyway.baseline-version}") String baselineVersion) {
        return Flyway.configure()
                .dataSource(dataSource)
                .baselineOnMigrate(baselineOnMigrate)
                .baselineVersion(baselineVersion)
                .load();
    }

    @Bean
    static BeanFactoryPostProcessor migrationBeforeJpa() {
        return factory -> {
            if (!factory.containsBeanDefinition("entityManagerFactory")) return;
            var definition = factory.getBeanDefinition("entityManagerFactory");
            var dependencies = new ArrayList<String>();
            if (definition.getDependsOn() != null) dependencies.addAll(Arrays.asList(definition.getDependsOn()));
            dependencies.add("flyway");
            definition.setDependsOn(dependencies.toArray(String[]::new));
        };
    }
}
