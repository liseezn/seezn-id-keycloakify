/**
 * SeeZn ID Admin Console 404.
 */

/* eslint-disable */

// @ts-nocheck

import { useTranslation } from "react-i18next";
import { FileQuestion, Home } from "lucide-react";

export const PageNotFoundSection = () => {
    const { i18n } = useTranslation();
    const zh = (i18n.language || "").toLowerCase().startsWith("zh");

    const changeLanguage = (language: string) => {
        void i18n.changeLanguage(language);
        document.documentElement.lang = language;
    };

    return (
        <div className="sz-admin-notfound">
            <span className="sz-admin-notfound-code">
                <FileQuestion size={22} aria-hidden="true" />
                404
            </span>
            <h1>{zh ? "页面未找到" : "Page not found"}</h1>
            <p>
                {zh
                    ? "很抱歉，您访问的管理页面不存在或已被移动。"
                    : "We are sorry, the administration page you requested could not be found or has moved."}
            </p>
            <a className="pf-v5-c-button pf-m-primary" href="#/">
                <Home size={16} aria-hidden="true" />
                {zh ? "返回管理后台" : "Back to admin console"}
            </a>
            <div className="sz-locale-switch" role="group" aria-label="Language">
                <button
                    type="button"
                    aria-pressed={zh}
                    onClick={() => changeLanguage("zh-CN")}
                >
                    中文
                </button>
                <button
                    type="button"
                    aria-pressed={!zh}
                    onClick={() => changeLanguage("en")}
                >
                    English
                </button>
            </div>
        </div>
    );
};
