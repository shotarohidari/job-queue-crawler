type Success<T> = {data: T, status:"success"};
type Err<T extends Error = Error> = {error:T,status:"failure"}

export type Result<T = unknown> = Success<T> | Err;