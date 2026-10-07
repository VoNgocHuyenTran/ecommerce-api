const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const express = require("express");
const { asyncRoute, httpError } = require("../errors");

function createAuthRouter(prisma, jwtSecret, jwtExpiresIn, authenticate) {
  const router = express.Router();

  function issueToken(user) {
    return jwt.sign(
      { uid: user.uid },
      jwtSecret,
      { algorithm: "HS256", expiresIn: jwtExpiresIn, issuer: "ecommerce-api" },
    );
  }

  router.post("/register", asyncRoute(async (req, res) => {
    const { username, fullname, password } = req.body || {};
    if (typeof username !== "string" || !/^[A-Za-z0-9_.-]{3,50}$/.test(username)) {
      throw httpError(400, "username must be 3-50 characters using letters, numbers, dots, underscores, or hyphens.");
    }
    if (typeof fullname !== "string" || fullname.trim().length < 1 || fullname.trim().length > 100) {
      throw httpError(400, "fullname must contain 1-100 characters.");
    }
    if (typeof password !== "string" || password.length < 12 || password.length > 128) {
      throw httpError(400, "password must contain 12-128 characters.");
    }

    const [role, membership] = await Promise.all([
      prisma.role.findUnique({ where: { rolename: "normal" } }),
      prisma.membership.findUnique({ where: { mname: "normal" } }),
    ]);
    if (!role || !membership) {
      throw new Error("Default normal role or membership is missing; run the database seed.");
    }

    const user = await prisma.user.create({
      data: {
        username,
        fullname: fullname.trim(),
        password: await bcrypt.hash(password, 12),
        roleid: role.roleid,
        mid: membership.mid,
      },
      select: {
        uid: true,
        username: true,
        fullname: true,
        role: { select: { rolename: true } },
        membership: { select: { mname: true, score: true } },
      },
    });
    res.status(201).json({
      user,
      token: issueToken(user),
      tokenType: "Bearer",
      expiresIn: jwtExpiresIn,
    });
  }));

  router.post("/login", asyncRoute(async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string") {
      throw httpError(400, "username and password are required.");
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        role: { select: { rolename: true } },
        membership: { select: { mname: true, score: true } },
      },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw httpError(401, "Invalid username or password.");
    }

    res.json({
      user: {
        uid: user.uid,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        membership: user.membership,
      },
      token: issueToken(user),
      tokenType: "Bearer",
      expiresIn: jwtExpiresIn,
    });
  }));

  router.get("/me", authenticate, asyncRoute(async (req, res) => {
    res.json({ user: req.user });
  }));

  return router;
}

module.exports = { createAuthRouter };
