import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RequestUser } from "./request-user.interface";

export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const req = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
  return req.user;
});
