import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { RequestUser } from "./request-user.interface";

type RequestWithUser = Request & { user?: RequestUser; headers: Record<string, string | string[] | undefined> };

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = String(req.headers["x-user-id"] ?? "");
    const tenantId = String(req.headers["x-tenant-id"] ?? "");
    const rolesRaw = String(req.headers["x-roles"] ?? "");
    const permsRaw = String(req.headers["x-permissions"] ?? "");

    if (!userId || !tenantId) {
      throw new UnauthorizedException("Missing x-user-id or x-tenant-id headers.");
    }

    req.user = {
      userId,
      tenantId,
      roles: rolesRaw ? rolesRaw.split(",").map((v) => v.trim()).filter(Boolean) : [],
      permissions: permsRaw ? permsRaw.split(",").map((v) => v.trim()).filter(Boolean) : [],
    };
    return true;
  }
}
