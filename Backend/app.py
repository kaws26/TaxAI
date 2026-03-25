from __future__ import annotations

from flask import Flask, jsonify
from dotenv import load_dotenv

from auth import auth_bp
from config import Config
from extensions import db, jwt
from tax_api import tax_bp


load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    jwt.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(tax_bp)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    with app.app_context():
        db.create_all()

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
