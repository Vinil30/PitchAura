from flask import send_from_directory

def register_routes(app, deps):
    BRAND_ASSET = deps.get("BRAND_ASSET")

    # ==================== UTILITY FUNCTIONS ====================

    @app.route("/favicon.ico")
    def favicon():
        return send_from_directory(app.root_path, BRAND_ASSET, mimetype="image/svg+xml")

    @app.route(f"/{BRAND_ASSET}")
    def brand_asset():
        return send_from_directory(app.root_path, BRAND_ASSET, mimetype="image/svg+xml")

    @app.route("/brand-logo.svg")
    def brand_logo():
        return send_from_directory(app.root_path, BRAND_ASSET, mimetype="image/svg+xml")
