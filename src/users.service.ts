import { Component } from '@nestjs/common';
import { HttpException } from '@nestjs/core';
import * as mongoose from 'mongoose';
import {Users} from './models/Users';

import * as jwt from 'jsonwebtoken';
import * as randomtoken from 'random-token';

@Component()
export class UsersService {
    private users = [
        { id: 1, name: "John Doe" },
        { id: 2, name: "Alice Caeiro" },
        { id: 3, name: "Who Knows" },
    ];
    getAllUsers() {
        let p = new Promise((resolve, reject)=>{
            Users.find({})
                .select(['-local.password','-refreshToken'])
                .exec((e,u)=>{
                    resolve(u);
                })
        });

        
        return p;
    }

    getUserByEmail(email: string, callback) {
        Users.findOne({'local.email': email})
                .select(['-local.password', '-refreshToken', '-refreshTokenExpiresIn', '-refreshTokenCreatedIn'])
                .exec((e,u)=>{
                    if (!u) {
                        throw new HttpException("User not found", 404);
                    }

                    callback(null, u);
                })
    }

    /**
     * 
     * @param email 
     * @param password 
     * @param options 
     * @param callback 
     */
    login (email: string, password: string, options: any, callback?){
        
        // options is optional parameter
		if(!callback){
			callback = options;
			options = null;
        }
        
        if(!options){
            options = {}
        }

        let valid = false;
        
        this.getUserByEmail(email, (error, user)=>{
            if(!user){
                // user not found
                return callback(null);
            }

            user.validPassword(password, (error, valid)=>{

                if(!valid){
                    // invalid password for user
                    return callback(null, false);
                }


                let tokenJWT = user.generateTokenJWT(options.jwt);
                user.generateRefreshToken(options.refreshToken);

				user.save(()=>{
                    callback(null, {user, token: tokenJWT, refreshToken: user.refreshToken});
                });
                
            });
        });
        
    }

    


    tokenVerify(token){
        if(!token) {
            throw 'token missing';
        }

        
        let decoded = jwt.verify(token, process.env.JWT_TOKEN_SECRET || 'demosecret');
        
        return decoded; 
    }

    tokenRefresh(token, refreshToken, options, callback?){

        if(!token) {
            throw 'token missing';
        }

        // options is optional parameter
		if(!callback){
			callback = options;
			options = null;
        }
        
        if(!options){
            options = {}
        }

        let decoded = jwt.decode(token, process.env.JWT_TOKEN_SECRET || 'demosecret');
        
        
        // find password for this user-object
        // and test if is valid
        Users.findById(decoded.id)
        .select(['local.email', 'refreshToken', 'refreshTokenExpiresIn', 'refreshTokenCreatedIn'])
        .exec((error, user)=>{
            
            if(error){
                console.log('return callback(error)', error)
                return callback(error);
            }

            let refreshTokenValid;

            try {
                refreshTokenValid = user.validRefreshToken(refreshToken);
            } catch (ex) {
                return callback(ex);
            }
           

            // create new refresh token
            if(refreshTokenValid){
                
                let tokenJWT = user.generateTokenJWT(options.jwt);
                
                //console.log(' user.generateRefreshToken #1', user.refreshToken, refreshToken)
                user.generateRefreshToken(options.refreshToken);
                //console.log(' user.generateRefreshToken #2', user.refreshToken, refreshToken)
                user.save((se, savedUser)=>{
                    //console.log(' user.generateRefreshToken #3', savedUser.refreshToken, refreshToken)
                    callback(null, {user, token: tokenJWT, refreshToken: savedUser.refreshToken});
                });
            } else {
                callback(null, refreshTokenValid);
            }

            
        });

    }

    
    addUser(user) {
        this.users.push(user);
        return Promise.resolve();
    }
}