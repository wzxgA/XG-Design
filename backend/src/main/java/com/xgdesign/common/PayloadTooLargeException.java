package com.xgdesign.common;

/** 请求体超限 → 413 */
public class PayloadTooLargeException extends RuntimeException {

    public PayloadTooLargeException(String message) {
        super(message);
    }
}
