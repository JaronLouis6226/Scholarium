import json
import os
import queue
import sys
import threading
import time
import webbrowser
from typing import List, Optional, Tuple

# 确保项目根目录在 sys.path 中（支持直接运行 python src/Main.py）
_sys_path_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _sys_path_root not in sys.path:
    sys.path.insert(0, _sys_path_root)

from flask import Flask, Response, jsonify, request, send_file, send_from_directory

from src import crawler
from src import extractor
from src import writer
from src.utils import logger

# ============================================================================
# Flask 应用
# ============================================================================

app = Flask(__name__, static_folder="webui", static_url_path="/static")

# SSE 消息队列（线程安全）
_sse_queue: queue.Queue[str] = queue.Queue()

# 采集结果（线程间共享）
_results: List[writer.ResultRow] = []
_output_file: str = ""
_task_running: bool = False
_task_lock = threading.Lock()

# 原始 logger.info 方法引用
_original_logger_info = logger.info


def _emit_log(message: str) -> None:
    """同时输出到终端和 SSE 队列"""
    _original_logger_info(message)
    _sse_queue.put(message)


# ============================================================================
# 核心采集逻辑
# ============================================================================

def _parse_urls(text: str) -> List[str]:
    parsed: List[str] = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            parsed.append(line)
    return parsed


def _process_single_url(url: str) -> Tuple[str, str, str]:
    fetch_result = crawler.fetch_url(url)

    if fetch_result.error:
        if "404" in fetch_result.error:
            _emit_log("状态：网页404")
        elif "超时" in fetch_result.error or "Timeout" in fetch_result.error:
            _emit_log("状态：网页连接超时")
        else:
            _emit_log("状态：链接无效")
        return ("", "网页无邮箱", "链接无效")

    if not fetch_result.success or not fetch_result.html:
        _emit_log("状态：链接无效")
        return ("", "网页无邮箱", "链接无效")

    _emit_log("2. 提取教师简介中……")
    profile_text = extractor.extract_teacher_profile(fetch_result.html, url)

    if profile_text:
        _emit_log("提取成功")
    else:
        _emit_log("提取失败")
        _emit_log("页面不存在教师简介信息")

    _emit_log("3. 提取教师邮箱中……")
    _emit_log("尝试从页面提取……")

    email = extractor.extract_email(fetch_result.html, url)
    if not email:
        email = "网页无邮箱"

    extractor.clear_pdf_cache()

    if not profile_text:
        _emit_log("状态：主页无内容")
        return ("", email, "主页无内容")

    if extractor.is_corner_content(profile_text):
        _emit_log("检测到内容几乎全为导航/公告等非教师简介，不填入表格")
        return ("", email, "主页无内容")

    max_len = 1500
    if len(profile_text) > max_len:
        profile_text = profile_text[:max_len]

    _emit_log("提取完成")
    return (profile_text, email, "")


def _run_crawl(
    urls_text: str,
    timeout: int,
    retries: int,
    delay_min: float,
    delay_max: float,
    min_content_len: int,
    output_filename: str,
) -> None:
    global _results, _output_file, _task_running

    with _task_lock:
        _task_running = True

    old_info = logger.info
    logger.info = _emit_log

    try:
        crawler.REQUEST_TIMEOUT = timeout
        crawler.MAX_RETRIES = retries
        crawler.RANDOM_DELAY_MIN = delay_min
        crawler.RANDOM_DELAY_MAX = delay_max
        extractor.MIN_CONTENT_LENGTH = min_content_len

        url_list = _parse_urls(urls_text)

        if not url_list:
            _emit_log("未发现有效 URL，请检查输入。")
            return

        total = len(url_list)
        _emit_log("［开始采集］")
        _emit_log(f"共 {total} 个URL")
        _emit_log("")

        results: List[writer.ResultRow] = []

        for idx, url in enumerate(url_list, 1):
            _emit_log(f"［{idx}/{total}］")
            _emit_log(f"URL：{url}")
            _emit_log("")

            content, email, has_content = _process_single_url(url)
            results.append((content, email, has_content))
            _emit_log("")

            if idx < total:
                crawler.random_delay()

        with _task_lock:
            _results = results
            _output_file = output_filename

        total = len(results)
        has_content = sum(1 for _, _, c in results if c == "")
        no_content = sum(1 for _, _, c in results if c == "主页无内容")
        dead_link = sum(1 for _, _, c in results if c == "链接无效")

        _emit_log("")
        _emit_log("［采集完成］")
        _emit_log(f"总计: {total}  |  有内容: {has_content}  |  无内容: {no_content}  |  无效: {dead_link}")

    finally:
        logger.info = old_info
        _sse_queue.put("__DONE__")
        with _task_lock:
            _task_running = False


# ============================================================================
# Flask 路由
# ============================================================================

@app.route("/")
def index() -> str:
    """主页面 —— 内嵌完整前端"""
    return _HTML_PAGE


@app.route("/font/GoogleSans.ttf")
def font_googlesans() -> Response:
    """提供 GoogleSans 字体文件"""
    import os as _os
    font_dir = _os.path.join(_os.path.dirname(__file__), "res")
    return send_from_directory(font_dir, "GoogleSans.ttf", mimetype="font/truetype")


@app.route("/font/NotoSans.ttf")
def font_notosans() -> Response:
    """提供 NotoSans 中文字体文件"""
    import os as _os
    font_dir = _os.path.join(_os.path.dirname(__file__), "res")
    return send_from_directory(font_dir, "NotoSans.ttf", mimetype="font/truetype")


@app.route("/run", methods=["POST"])
def run() -> Response:
    """启动采集任务"""
    global _results, _output_file, _task_running

    with _task_lock:
        if _task_running:
            return jsonify({"error": "已有任务在运行中"}), 409 # type: ignore
        _results = []
        _output_file = ""

    data = request.get_json(silent=True) or {}
    urls_text = data.get("urls", "")
    timeout = int(data.get("timeout", 5))
    retries = int(data.get("retries", 3))
    delay_min = float(data.get("delay_min", 0.1))
    delay_max = float(data.get("delay_max", 0.5))
    min_content_len = int(data.get("min_content_len", 30))
    output_filename = data.get("output_filename", "teachers.xlsx")

    thread = threading.Thread(
        target=_run_crawl,
        args=(urls_text, timeout, retries, delay_min, delay_max,
              min_content_len, output_filename),
        daemon=True,
    )
    thread.start()

    return jsonify({"status": "started"})


@app.route("/stream")
def stream() -> Response:
    """SSE 端点：实时推送采集日志"""
    def generate():
        while True:
            try:
                msg = _sse_queue.get(timeout=30)
                if msg == "__DONE__":
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    break
                yield f"data: {json.dumps({'type': 'log', 'text': msg})}\n\n"
            except queue.Empty:
                yield f"data: {json.dumps({'type': 'ping'})}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/results")
def results() -> Response:
    """获取采集结果"""
    with _task_lock:
        data = [
            {"content": c, "email": e, "status": s}
            for c, e, s in _results
        ]
    return jsonify({"results": data, "output_file": _output_file})


@app.route("/download")
def download() -> Response:
    """按需生成并下载 Excel 文件"""
    with _task_lock:
        if not _results:
            return jsonify({"error": "无采集结果，请先运行采集任务"}), 400 # type: ignore
        filename = _output_file or "teachers.xlsx"
        try:
            writer.write_excel(list(_results), filename)
        except Exception as e:
            return jsonify({"error": f"Excel 生成失败: {e}"}), 500 # type: ignore

    filepath = os.path.join(os.getcwd(), filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "文件生成失败"}), 500 # type: ignore
    return send_file(filepath, as_attachment=True)


@app.route("/status")
def status() -> Response:
    """查询任务是否运行中"""
    with _task_lock:
        return jsonify({"running": _task_running})


# ============================================================================
# 前端页面
# ============================================================================

_WEBUI_DIR = os.path.join(os.path.dirname(__file__), "webui")


def _load_html() -> str:
    """读取 index.html"""
    with open(os.path.join(_WEBUI_DIR, "index.html"), "r", encoding="utf-8") as f:
        return f.read()


_HTML_PAGE: str = ""


# ============================================================================
# 入口
# ============================================================================


def main() -> None:
    global _HTML_PAGE
    _HTML_PAGE = _load_html()
    port = 5080
    url = f"http://127.0.0.1:{port}"
    print(f"Scholarium Web UI 启动: {url}")
    print("按 Ctrl+C 停止服务器\n")

    def _open_browser():
        time.sleep(0.6)
        webbrowser.open(url)

    threading.Thread(target=_open_browser, daemon=True).start()

    app.run(host="0.0.0.0", port=port, debug=False)


if __name__ == "__main__":
    main()
