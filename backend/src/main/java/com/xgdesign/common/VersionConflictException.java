package com.xgdesign.common;

/** 乐观锁版本冲突 → 409 */
public class VersionConflictException extends RuntimeException {

    public VersionConflictException(String message) {
        super(message);
    }
}
