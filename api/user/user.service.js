import fs from 'fs'
import { makeId, readJsonFile } from '../../services/util.service.js'

import { ObjectId } from "mongodb"

import { logger } from "../../services/logger.service.js"

import { dbService } from "../../services/db.service.js"
import { error } from 'console'
import { createDiffieHellmanGroup } from 'crypto'



export const userService = {
    query,
    getById,
    remove,
    save,
    add,
    getByUsername
}



async function query(filter = {}) {
  try {
    const usersCol = await dbService.getCollection('users');
    const users = await usersCol
      .find(filter, { projection: { password: 0 } }) // hide sensitive fields
      .toArray();                                    // <-- crucial

    // normalize _id for the client (optional)
    return users.map(u => ({ ...u, _id: u._id?.toString?.() ?? u._id }));
  } catch (err) {
    throw err;
  }
}

async function getById(userId) {
    try {
        var criteria = { _id: ObjectId.createFromHexString(userId) }

        const collection = await dbService.getCollection('users')
        const user = await collection.findOne(criteria)
        delete user.password

        criteria = { byUserId: userId }


        return user
    } catch (err) {
        logger.error(`while finding user by id: ${userId}`, err)
        throw err
    }
}

function remove(userId) {
    users = users.filter(user => user._id !== userId)
    return _saveUsersToFile()
}

function save(user) {
    user._id = makeId()
    // TODO: severe security issue- attacker can post admins
    users.push(user)
    return _saveUsersToFile().then(() => user)

}

function _saveUsersToFile() {
    return new Promise((resolve, reject) => {
        const usersStr = JSON.stringify(users, null, 4)
        fs.writeFile('data/user.json', usersStr, (err) => {
            if (err) {
                return console.log(err);
            }
            resolve()
        })
    })
}


async function add(user) {
    try {
        // peek only updatable fields!
        const userToAdd = {
            username: user.username,
            password: user.password,
            avatarUrl: user.avatarUrl
            
         
          
        }
        const collection = await dbService.getCollection('users')
        await collection.insertOne(userToAdd)
        return userToAdd
    } catch (err) {
        logger.error('cannot add user', err)
        throw err
    }
}


async function getByUsername(username) {
    try {
        const collection = await dbService.getCollection('users')
        const user = await collection.findOne({ username })
        return user
    } catch (err) {
        logger.error(`while finding user by username: ${username}`, err)
        throw err
    }
}