const jwt = require("jsonwebtoken");
const { asyncRoute, httpError } = require("../errors");

function createAuthMiddleware(prisma, jwtSecret) {
  return {
    authenticate: asyncRoute(async (req, _res, next) => {
      const authorization = req.get("authorization") || "";
      const [scheme, token] = authorization.split(" ");
      if (scheme !== "Bearer" || !token) {
        throw httpError(401, "A Bearer access token is required.");
      }

      let payload;
      try {
        payload = jwt.verify(token, jwtSecret, {
          algorithms: ["HS256"],
          issuer: "ecommerce-api",
        });
      } catch {
        throw httpError(401, "The access token is invalid or expired.");
      }

      if (!payload || typeof payload !== "object" || !Number.isInteger(payload.uid)) {
        throw httpError(401, "The access token is invalid or expired.");
      }

      const user = await prisma.user.findUnique({
        where: { uid: payload.uid },
        select: {
          uid: true,
          username: true,
          fullname: true,
          role: { select: { rolename: true } },
          membership: { select: { mname: true, score: true } },
        },
      });
      if (!user) {
        throw httpError(401, "The account for this access token no longer exists.");
      }

      req.user = user;
      next();
    }),
    requireAdmin: (req, _res, next) => {
      if (req.user?.role.rolename !== "admin") {
        return next(httpError(403, "Administrator access is required."));
      }
      next();
    },
  };
}

module.exports = { createAuthMiddleware };
