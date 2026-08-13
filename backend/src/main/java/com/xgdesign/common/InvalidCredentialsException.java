package com.xgdesign.common;

/** 邮箱或密码错误：HTTP 401，业务码 40101。 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException(String message) {
        super(message);
    }
}
