import { handleClassMissions } from '../_shared/classMissionsServer.ts';
Deno.serve((request) => handleClassMissions(request, true));
