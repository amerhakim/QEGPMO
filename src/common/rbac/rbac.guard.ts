import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "./permissions.decorator";
import { RequestUser } from "../auth/request-user.interface";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (!req.user) {
      throw new ForbiddenException("Unauthenticated request.");
    }

    const hasAll = requiredPermissions.every((permission) => req.user!.permissions.includes(permission));
    if (!hasAll) {
      throw new ForbiddenException("Missing required permissions.");
    }
    return true;
  }
}
