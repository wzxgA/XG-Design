package com.xgdesign.common;

/** 注册时邮箱已存在：HTTP 409，业务码 40901。 */
public class EmailAlreadyRegisteredException extends RuntimeException {

    public EmailAlreadyRegisteredException(String message) {
        super(message);
    }
}
