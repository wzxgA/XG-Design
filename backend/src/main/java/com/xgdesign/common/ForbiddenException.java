package com.xgdesign.common;

/** 无权访问（非本人文档 / 成员权限不足）：HTTP 403。 */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
