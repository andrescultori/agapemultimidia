import handler from '../../api/settings.js';
import { run } from '../_adapter.js';

export const onRequest = (context) => run(handler, context);
