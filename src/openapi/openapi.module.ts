import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '../config/config.service';

export class OpenAPIModule {
    public static setup(path: string, app: INestApplication): void {
        const configService: ConfigService = app.get(ConfigService);

        // Create a new type for the options, per the OpenAPIObject interface requirements
        type OpenAPIOptions = Pick<OpenAPIObject, 'openapi' | 'info' | 'servers' | 'security' | 'tags' | 'externalDocs'>;

        const options: OpenAPIOptions = new DocumentBuilder()
            .setTitle(configService.config.LOG_LABEL)
            .setDescription('Bull metrics exporter')
            .setVersion(configService.config.VERSION)
            .build();

        // Create the swagger document
        const document: OpenAPIObject = SwaggerModule.createDocument(app, options);
        SwaggerModule.setup(path, app, document);
    }
}
