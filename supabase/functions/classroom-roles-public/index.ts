import { handleClassroomRoles } from "../_shared/classroomRolesServer.ts";
Deno.serve((request) => handleClassroomRoles(request, true));
