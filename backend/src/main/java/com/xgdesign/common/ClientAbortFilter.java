package com.xgdesign.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.catalina.connector.ClientAbortException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;

/**
 * 客户端断连过滤器。
 *
 * <p>浏览器在响应写完前断开连接（刷新/关页/取消请求等）时，Tomcat 会抛出
 * {@link ClientAbortException}（底层多为 Broken pipe / Connection reset），
 * 这是正常现象而非服务端错误。此处捕获并降级为 debug 日志，避免刷屏 ERROR 堆栈。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ClientAbortFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ClientAbortFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            chain.doFilter(request, response);
        } catch (ClientAbortException ex) {
            log.debug("客户端断开连接（ClientAbort）：{} {}", request.getMethod(), request.getRequestURI());
        } catch (IOException ex) {
            if (isConnectionAborted(ex)) {
                log.debug("客户端断开连接（{}）：{} {}", ex.getClass().getSimpleName(),
                        request.getMethod(), request.getRequestURI());
            } else {
                throw ex;
            }
        }
    }

    /** 判断是否为连接被客户端中止（Broken pipe / Connection reset），而非真实 IO 错误 */
    private static boolean isConnectionAborted(IOException ex) {
        String msg = ex.getMessage();
        if (msg == null) return false;
        String lower = msg.toLowerCase(Locale.ROOT);
        return lower.contains("broken pipe")
                || lower.contains("connection reset")
                || lower.contains("connection aborted")
                || lower.contains("中止")
                || lower.contains("重置")
                || lower.contains("established connection")
                || lower.contains("software");
    }
}
