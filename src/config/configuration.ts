import appConfig from './sections/app.config';
import kafkaConfig from './sections/kafka.config';

export default () => ({
  app: appConfig(),
  kafka: kafkaConfig(),
});
