// import express from "express";
// import nodemailer from "nodemailer";
// import crypto, { getHashes } from "crypto";
// import { prisma } from "../../prisma";
// //import { networkInterfaces } from "os";

// const router = express.Router();

// router.post("/password-reset-link", async (req, res) => {
//   const { email } = req.body;
//   // todo: write your code here
//   // 1. verify if email is in database
//   try {
//     //使用prisma来查找y用户的email是否在数据库当中，如果在 existing user的值等于1
//     const existingUser = await prisma.user.findUnique({ where: { email } });
//     if (!existingUser) {
//       //如果不在数据库当中
//       return res.status(404).send({ Error: "Email address doesn't exist" });
//     }
//   } catch (error) {
//     //如果查询失败，就是服务器内部出现了问题，抛出异常
//     console.error("Error Querying Database", error);
//     return res.status(500).send({ error: "Internal Server Error." });
//   }

//   const timestamp = Date.now();
//   const currentDate = new Date(timestamp);

//   console.log(email, currentDate.toLocaleString());

//   const token = crypto.randomBytes(20).toString("hex");
//   const resetLink = process.env.FRONTEND_URL + `/password-reset/${token}`;
//   // Validate the email (make sure it's registered, etc.)

//   // Create a reset token and expiry date for the user
//   await prisma.user.update({
//     where: { email: email },
//     data: {
//       resetToken: token,
//       resetTokenExpiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now,用秒表示，避免big int
//     },
//   });

//   // Create a transporter object using the default SMTP transport
//   const transporter = nodemailer.createTransport({
//     service: "gmail", // Use your preferred email service
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });

//   // Email content
//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: email,
//     subject: "Password Reset",
//     text: `Click the link below to reset your password:\n${resetLink}\nIf you did not request a password reset, please ignore this email.`,
//     // You'd typically generate a unique link for the user to reset their password
//   };

//   try {
//     await transporter.sendMail(mailOptions);
//     res.status(200).send({ message: "Reset email sent successfully." });
//   } catch (error) {
//     console.error("Error sending email:", error);
//     res.status(500).send({ error: "Failed to send reset email." });
//   }
// });

// router.post("/password-reset/confirm", async (req, res) => {
//   // 1. Find the user by the token
//   // 2. Verify that the token hasn't expired
//   // 3. Hash the new password
//   // 4. Update the user's password in the database
//   // 5. Invalidate the token so it can't be used again
//   // 6. Send a response to the frontend
//   const { token, password } = req.body;
//   console.log(token, password);
//   try {
//     //通过生成的token来查找user
//     const user = await prisma.user.findFirst({ where: { resetToken: token } });
//     if (!user) {
//       return res.status(404).send({ error: "Invalid user" });
//     }
//     //如果token过期了，显示错误
//     if (user.resetTokenExpiry != null && user.resetTokenExpiry < Date.now()) {
//       return res.status(400).send({ error: "Token expired" });
//     }
//     //根据用户id生成salt，再根据salt进行加密
//     const dynamicSalt = user.id.toString();
//     const hashedPassword = crypto
//       .createHash("sha256")
//       .update(password + dynamicSalt)
//       .digest("hex");

//     await prisma.user.update({
//       where: { id: user.id },
//       data: {
//         password: hashedPassword,
//         resetToken: null,
//         resetTokenExpiry: null,
//       },
//     });
//     return res.status(200).send({ message: "Password reset seccessfully" });
//   } catch (error) {
//     console.error("Error resetting password", error);
//     return res.status(500).send({ error: "Internal Server Error" });
//   }

//   // 1. Find the user by the token

//   // 2. Verify that the token hasn't expired (assuming you have an expiry date in your DB)
//   // If you have a resetTokenExpiry field in your User model:

//   // 3. Hash the new password
//   // const hashedPassword = await bcrypt.hash(password, 10);

//   // 4. Update the user's password in the database

//   // 6. Send a response to the frontend
// });
import express from "express";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// 发送密码重置链接
router.post("/password-reset/link", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const token = crypto.randomBytes(20).toString("hex");
    const resetTokenExpiry = Math.floor(Date.now() / 1000) + 3600; // 1小时后过期

    await prisma.user.update({
      where: { email: email },
      data: {
        resetToken: token,
        resetTokenExpiry: resetTokenExpiry,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL}/password-reset/${token}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Link",
      text: `You requested a password reset. Click the link to reset your password: ${resetLink}`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Password reset link sent." });
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 确认密码重置
router.post("/password-reset/confirm", async (req, res) => {
  const { token, password } = req.body;

  try {
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: currentTimeInSeconds,
        },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Token is invalid or has expired." });
    }

    // 这里假设你使用环境变量中的SALT_KEY进行密码加密
    const saltKey = process.env.SALT_KEY || "default_salt_key";
    const hashedPassword = crypto
      .pbkdf2Sync(password, saltKey, 10000, 64, "sha512")
      .toString("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.status(200).json({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error("Password reset confirm error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
