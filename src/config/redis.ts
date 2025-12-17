import { error } from "console";
import Redis from "ioredis";
const redis= new Redis({
    host:process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
    ? Number(process.env.REDIS_PORT)
    : 6379,
    password:process.env.REDIS_PASSWORD
});
redis.on('connect',()=>{
    console.log('Connected to Redis');
})
redis.on("error",(err)=>{
    console.log("Redis connection error",err)
})
export default redis;