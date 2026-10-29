// Compatibility export for offline policy tests. Collection is owned by Cloudflare.
import {pathToFileURL} from 'node:url';
export {reserve} from './ais-policy.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 console.log('Collection moved to Cloudflare Cron; GitHub must only mirror cached observations.');
}
