import express from 'express';
import cors from 'cors';
import { env } from './utils/env.js';
import contactsRouter from './routers/contacts.js';
import notFoundHandler from './middlewares/notFoundHandler.js';
import errorHandler from './middlewares/errorHandler.js';
import logger from './middlewares/logger.js';
import authRouter from './routers/auth.js';
import cookieParser from "cookie-parser";
import { swaggerDocs } from "./middlewares/swaggerDocs.js";



// console.log(process.env.PORT); // тут будуть налаштування компа або сервера на якому запускаємо, тому можуть бути різні налащтування PORT

export const startServer = () => {
	const app = express(); // app - web server - створення сервера

	// app.use(logger); // використовуємо раніше створену мідлвару 
	app.use(cors()); // корототкий запис створення і використання мідлвару CORS
	app.use(express.json());
	app.use(cookieParser());
	app.use('/api-docs', swaggerDocs);
	app.use(express.static("uploads"));


	// routes;
	app.use('/auth', authRouter);
	app.use('/contacts', contactsRouter);

	app.use(notFoundHandler);

	app.use(errorHandler);

	const port = Number(env('PORT', 3000));

	app.listen(port, () => console.log(`Server is running on port ${port}`))  // запуск сервера 



}; 