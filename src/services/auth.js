import createHttpError from 'http-errors';
import UserCollection from '../db/models/User.js';
import bcrypt from "bcrypt";
import SessionCollection from "../db/models/Session.js";
import { randomBytes } from "crypto";
import { accessTokenLifetime, refreshTokenLifetime } from "../constants/users.js";
import jwt from 'jsonwebtoken';
import { SMTP, TEMPLATES_DIR } from '../constants/index.js';
import { env } from '../utils/env.js';
import { sendEmail } from '../utils/sendMail.js';
import handlebars from 'handlebars';
import path from 'node:path';
import fs from 'node:fs/promises';
import "dotenv/config";

const createSession = () => {
	const accessToken = randomBytes(30).toString("base64");
	const refreshToken = randomBytes(30).toString("base64");
	const accessTokenValidUntil = new Date(Date.now() + accessTokenLifetime);
	const refreshTokenValidUntil = new Date(Date.now() + refreshTokenLifetime);

	return {
		accessToken,
		refreshToken,
		accessTokenValidUntil,
		refreshTokenValidUntil,
	};
};


export const register = async (payload) => {
	const { email, password } = payload;

	const user = await UserCollection.findOne({ email });
	if (user) {
		throw createHttpError(409, "Email in use");
	}

	const hashPassword = await bcrypt.hash(password, 10);

	const data = await UserCollection.create({ ...payload, password: hashPassword });
	delete data._doc.password;

	return data._doc;
};

export const login = async (payload) => {
	const { email, password } = payload;
	const user = await UserCollection.findOne({ email });
	if (!user) {
		throw createHttpError(401, "Email or password invalid");
	}

	const passwordCompare = await bcrypt.compare(password, user.password);
	if (!passwordCompare) {
		throw createHttpError(401, "Email or password invalid");
	}

	await SessionCollection.deleteOne({ userId: user._id });

	const sessionData = createSession();

	const userSession = await SessionCollection.create({
		userId: user._id,
		...sessionData,
	});

	return userSession;


};

export const findSessionByAccessToken = accessToken => SessionCollection.findOne({ accessToken });

export const refreshSession = async ({ refreshToken, sessionId }) => {
	const oldSession = await SessionCollection.findOne({
		_id: sessionId,
		refreshToken,
	});

	if (!oldSession) {
		throw createHttpError(401, "Session not found");
	}

	if (new Date() > oldSession.refreshTokenValidUntil) {
		throw createHttpError(401, "Session token expired");
	}

	await SessionCollection.deleteOne({ _id: sessionId });

	const sessionData = createSession();

	const userSession = await SessionCollection.create({
		userId: oldSession._id,
		...sessionData,
	});

	return userSession;
};

export const logout = async (sessionId) => {
	await SessionCollection.deleteOne({ _id: sessionId });
};


export const findUser = filter => UserCollection.findOne(filter);

export const requestResetToken = async (email) => {
	const user = await UserCollection.findOne({ email });
	if (!user) {
		throw createHttpError(404, 'User not found');
	}
	const resetToken = jwt.sign(
		{
			sub: user._id,
			email,
		},
		env('JWT_SECRET'),
		{
			expiresIn: '5m',
		},
	);

	console.log(resetToken);

	const resetPasswordTemplatePath = path.join(
		TEMPLATES_DIR,
		'reset-password-email.html',
	);

	const templateSource = (
		await fs.readFile(resetPasswordTemplatePath)
	).toString();

	const template = handlebars.compile(templateSource);
	const html = template({
		name: user.name,
		link: `${env('APP_DOMAIN')}/reset-password?token=${resetToken}`,
	});

	const sendAwaitEmail = await sendEmail({
		from: env(SMTP.SMTP_FROM),
		to: email,
		subject: 'Reset your password',
		html,
	});

	// console.log(sendAwaitEmail.rejected.length);
	if (!sendAwaitEmail.rejected === 0) {
		throw createHttpError(500, 'Failed to send the email, please try again later.');
	};
};

export const resetPassword = async (payload) => {
	let entries;

	try {
		entries = jwt.verify(payload.token, env('JWT_SECRET'));
	} catch (err) {
		if (err instanceof Error) throw createHttpError(401, 'Token is expired or invalid.');
		throw err;
	}

	console.log(entries.exp);
	console.log(Date.now() > entries.exp);



	const user = await UserCollection.findOne({
		email: entries.email,
		_id: entries.sub,
	});

	console.log(user);

	if (!user) {
		throw createHttpError(404, 'User not found!');
	}

	if (!Date.now() > entries.exp) {
		throw createHttpError(401, 'Token is expired or invalid.');
	}

	const encryptedPassword = await bcrypt.hash(payload.password, 10);

	await UserCollection.updateOne(
		{ _id: user._id },
		{ password: encryptedPassword },
	);
	await SessionCollection.deleteOne({ userId: user._id });
};

