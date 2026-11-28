import handler from '../../../api/admin/[action].js';
import { run } from '../../_adapter.js';

export const onRequest = (context) => run(handler, context, { action: context.params.action });
