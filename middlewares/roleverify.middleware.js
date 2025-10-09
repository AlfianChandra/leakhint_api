export const verifyRole = () => {
  const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
      return next();
    }
    logger.warn(
      `[ROLEVERIFY] IP: ${req.ip} - Path: ${req.originalUrl} - Message: Unauthorized access attempt by non-admin user.`
    );
    return res
      .status(403)
      .json({ message: "forbidden", err_code: "ROLE_VERIFY_FORBIDDEN" });
  };

  const userOnly = (req, res, next) => {
    if (req.user && req.user.role === "user") {
      return next();
    }
    logger.warn(
      `[ROLEVERIFY] IP: ${req.ip} - Path: ${req.originalUrl} - Message: Unauthorized access attempt by non-user.`
    );
    return res
      .status(403)
      .json({ message: "forbidden", err_code: "ROLE_VERIFY_FORBIDDEN" });
  };

  return {
    adminOnly,
    userOnly,
  };
};

export default verifyRole;
