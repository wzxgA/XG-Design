package com.xgdesign.ai;

/**
 * AI 功能未启用时抛出（对应 HTTP 503）。
 */
public class AiDisabledException extends RuntimeException {

    public AiDisabledException() {
        super("AI 功能未启用");
    }
}
