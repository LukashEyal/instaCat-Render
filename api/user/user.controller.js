import { userService } from "./user.service.js"
import { logger } from "../../services/logger.service.js"


export async function getUser(req, res) {
	try {
		const user = await userService.getById(req.params.id)
		res.send(user)
	} catch (err) {
		logger.error("Failed to get user", err)
		res.status(400).send({ err: "Failed to get user" })
	}
}

export async function getUsers(req, res, next) {
  try {
    const users = await userService.query();
    res.send(users); // array of plain docs = safe to serialize
  } catch (err) {
    // log, then delegate to centralized error handler
    logger.error('Failed to get users', { msg: err.message, stack: err.stack });
    next(err);
  }
}

export async function deleteUser(req, res) {
	try {
		await userService.remove(req.params.id)
		res.send({ msg: "Deleted successfully" })
	} catch (err) {
		logger.error("Failed to delete user", err)
		res.status(400).send({ err: "Failed to delete user" })
	}
}

export async function updateUser(req, res) {
	try {
		const user = req.body
		const savedUser = await userService.update(user)
		res.send(savedUser)
	} catch (err) {
		logger.error("Failed to update user", err)
		res.status(400).send({ err: "Failed to update user" })
	}
}
