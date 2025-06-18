import appConfig from './sections/app.config';
import kafkaConfig from './sections/kafka.config';
import schedulerConfig from './sections/scheduler.config';
import recoveryConfig from './sections/recovery.config';

export default () => ({
  app: appConfig(),
  kafka: kafkaConfig(),
  scheduler: schedulerConfig(),
  recovery: recoveryConfig(),
});
