const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const User = require("../models/user");
const config = require("config");
const bcrypt = require("bcrypt");
const auth = require("../middleware/auth");

// @route POST /api/auth
// @desc Authorize user
// @access Public
router.post(
  "/",
  [
    check("email", "Enter a valid email").isEmail(),
    check("password", "Enter a password").not().isEmpty(),
  ],
  async (req, res) => {
    // Validate Data inside request body
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    // Get Data
    const { email, password } = req.body;

    try {
      // Check User
      const user = await User.findOne({ email });
      if (!user)
        return res
          .status(400)
          .json({ msg: "User with this email does not exist" });

      // Check Password
      const isMatched = await bcrypt.compare(password, user.password);
      if (!isMatched)
        return res.status(400).json({ msg: "Incorrect Password" });

      // Return jwt
      const payload = {
        user: {
          id: user.id,
        },
      };
      jwt.sign(
        payload,
        config.get("jwtSecret"),
        {
          expiresIn: 100000,
        },
        (err, token) => {
          if (err) throw err;
          res.status(200).json({ token });
        }
      );
    } catch (err) {
      console.log("Error ", err.message);
      res.status(500).json({ msg: "Server Error" });
    }
  }
);

// @route GET /api/auth
// @desc GET User Data
// @access Private
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select({
      password: 0,
      __v: 0,
    });
    res.status(200).json({ user });
  } catch (err) {
    console.log("Error ", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
