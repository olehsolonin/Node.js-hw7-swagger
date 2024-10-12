import * as contactServices from '../services/contacts.js';
import createHttpError from 'http-errors';
import parsePaginationParams from '../utils/parsePaginationParams.js';
import parseSortParams from '../utils/parseSortParams.js';
import { sortFields } from '../db/models/Contact.js';
import { parseContactsFilterParams } from '../utils/filters/parseContactsFilterParams.js';
import saveFileToUploadDir from '../utils/saveFileToUploadDir.js';
import saveFileToCloudinary from '../utils/saveFileToCloudinary.js';
import { env } from '../utils/env.js';

const enableCloudinary = env("ENABLE_CLOUDINARY");

export const getAllContactsController = async (req, res, next) => {

	const { perPage, page } = parsePaginationParams(req.query);
	const { sortBy, sortOrder } = parseSortParams({ ...req.query, sortFields });
	const { _id: userId } = req.user;
	const filter = parseContactsFilterParams(req.query);
	console.log(filter);
	// console.log(perPage);
	// console.log(page);
	// console.log(sortBy);
	// console.log(sortOrder);

	try {
		const data = await contactServices.getContacts({
			perPage,
			page,
			sortBy,
			sortOrder,
			filter: { ...filter, userId },
		});

		res.json({
			status: 200,
			message: 'Successfully found contacts!',
			data,
		});
	} catch (error) {
		next(error);
	}

	console.log({ perPage, page, sortBy, sortOrder, filter });


};

export const getContactByIdController = async (req, res, next) => {

	const { id } = req.params;
	const { _id: userId } = req.user;
	const data = await contactServices.getContact({ _id: id, userId });
	if (!data) {
		throw createHttpError(404, `Contact with id=${id} not found`);
	};

	res.json({
		status: 200,
		message: `Successfully found contact with id ${id}!`,
		data,
	});

};

export const addContactController = async (req, res) => {
	// console.log(req.body);
	// console.log(req.file);

	let photo;
	if (req.file) {
		if (enableCloudinary === "true") {
			photo = await saveFileToCloudinary(req.file, "photo");
		}
		else {
			photo = await saveFileToUploadDir(req.file);
		}
	}


	const { _id: userId } = req.user;
	const data = await contactServices.createContact({ ...req.body, userId, photo });
	console.log(data);

	res.status(201).json({
		status: 201,
		message: 'Contact add successfully',
		data
	});
};

export const upsertContactController = async (req, res) => {
	const { id } = req.params;
	const { _id: userId } = req.user;
	const { isNew, data } = await contactServices.updateContact({ _id: id, userId }, req.body, { upsert: true });

	const status = isNew ? 201 : 200;

	res.status(status).json({
		status,
		message: 'Contact upsert successfully',
		data,
	})
};

export const patchContactController = async (req, res) => {
	const { id } = req.params;
	const { _id: userId } = req.user;
	const result = await contactServices.updateContact({ _id: id, userId }, req.body);
	console.log(result);

	if (!result) {
		throw createHttpError(404, `Contact with id=${id} not found salam brat`);
	}

	res.status(200).json({
		status: 200,
		message: "Contact patched successfully",
		data: result.data,
	});
};

export const deleteContactController = async (req, res) => {
	const { id } = req.params;
	const { _id: userId } = req.user;
	const data = await contactServices.deleteContact({ _id: id, userId });

	if (!data) {
		throw createHttpError(404, `Contact with id=${id} not found`);
	}

	res.status(204).send();
};
