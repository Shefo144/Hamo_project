from flask import Flask, jsonify, request, send_from_directory
import pandas as pd
import os
import re
import math

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, "EAFC26-Men.csv")

df = pd.read_csv(CSV_FILE)
df = df.fillna("")

required_columns = [
    "ID", "Name", "Position", "Age", "Nation",
    "League", "Team", "Preferred foot", "OVR",
    "PAC", "SHO", "PAS", "DRI", "DEF", "PHY",
    "Alternative positions", "card"
]

for column in required_columns:
    if column not in df.columns:
        df[column] = ""

df["ID"] = df["ID"].astype(str)
df["Name"] = df["Name"].astype(str)

SKILL_COLUMNS = [
    ("OVR", "minOVR"),
    ("PAC", "minPAC"),
    ("SHO", "minSHO"),
    ("PAS", "minPAS"),
    ("DRI", "minDRI"),
    ("DEF", "minDEF"),
    ("PHY", "minPHY"),
    ("Acceleration", "minAcceleration"),
    ("Sprint Speed", "minSprint"),
    ("Finishing", "minFinishing"),
    ("Shot Power", "minShotPower"),
    ("Long Shots", "minLongShots"),
    ("Vision", "minVision"),
    ("Short Passing", "minShortPassing"),
    ("Dribbling", "minDribbling"),
    ("Ball Control", "minBallControl"),
    ("Stamina", "minStamina"),
    ("Strength", "minStrength"),
]


def get_number(value):
    try:
        if value is None or str(value).strip() == "":
            return None

        number = float(value)

        if not math.isfinite(number):
            return None

        return number

    except (ValueError, TypeError):
        return None


def clean_player(row):
    player = {}

    for column, value in row.items():
        if pd.isna(value):
            player[column] = ""
        else:
            player[column] = str(value)

    return player


def filter_players(args):
    data = df.copy()

    position = args.get("position", "").strip()
    min_age = get_number(args.get("minAge"))
    max_age = get_number(args.get("maxAge"))

    if position:
        pattern = (
            rf"(?<![A-Za-z]){re.escape(position)}(?![A-Za-z])"
        )

        main_position = data["Position"].astype(str).str.contains(
            pattern,
            case=False,
            na=False,
            regex=True
        )

        alternative_position = data[
            "Alternative positions"
        ].astype(str).str.contains(
            pattern,
            case=False,
            na=False,
            regex=True
        )

        data = data[main_position | alternative_position]

    age = pd.to_numeric(data["Age"], errors="coerce")

    if min_age is not None:
        data = data[age >= min_age]

    if max_age is not None:
        age = pd.to_numeric(data["Age"], errors="coerce")
        data = data[age <= max_age]

    for column, parameter in SKILL_COLUMNS:
        minimum = get_number(args.get(parameter))

        if minimum is not None and column in data.columns:
            values = pd.to_numeric(data[column], errors="coerce")
            data = data[values >= minimum]

    exact_filters = {
        "nation": "Nation",
        "league": "League",
        "team": "Team",
        "preferredFoot": "Preferred foot",
    }

    for parameter, column in exact_filters.items():
        value = args.get(parameter, "").strip()

        if value and column in data.columns:
            data = data[
                data[column].astype(str).str.casefold()
                == value.casefold()
            ]

    return data


def paginated_response(data):
    page = max(
        1,
        int(get_number(request.args.get("page")) or 1)
    )

    per_page = int(
        get_number(request.args.get("per_page")) or 24
    )

    per_page = min(max(per_page, 1), 100)

    total = len(data)
    total_pages = math.ceil(total / per_page) if total else 0

    start = (page - 1) * per_page
    page_data = data.iloc[start:start + per_page]

    players = [
        clean_player(row)
        for _, row in page_data.iterrows()
    ]

    return jsonify({
        "players": players,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages
    })


@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/style.css")
def style():
    return send_from_directory(BASE_DIR, "style.css")


@app.route("/script.js")
def script():
    return send_from_directory(BASE_DIR, "script.js")


@app.route("/options")
def get_options():
    def sorted_values(column):
        values = df[column].astype(str).str.strip()
        values = values[values != ""]

        return sorted(
            values.unique().tolist(),
            key=str.casefold
        )

    positions = set()

    for value in df["Position"].astype(str):
        for position in re.split(r"[,/;| ]+", value):
            position = position.strip()

            if position:
                positions.add(position)

    return jsonify({
        "nations": sorted_values("Nation"),
        "leagues": sorted_values("League"),
        "teams": sorted_values("Team"),
        "positions": sorted(positions)
    })


@app.route("/players")
def get_players():
    data = filter_players(request.args)
    return paginated_response(data)


@app.route("/all-players")
def get_all_players():
    return paginated_response(df)


@app.route("/suggest")
def suggest_players():
    query = request.args.get("q", "").strip()

    if not query:
        return jsonify([])

    matches = df[
        df["Name"].astype(str).str.contains(
            re.escape(query),
            case=False,
            na=False,
            regex=True
        )
    ].head(12)

    return jsonify([
        {
            "ID": str(row["ID"]),
            "Name": str(row["Name"]),
            "Team": str(row["Team"]),
            "Position": str(row["Position"]),
            "OVR": str(row["OVR"]),
            "card": str(row["card"]),
        }
        for _, row in matches.iterrows()
    ])


@app.route("/player/<player_id>")
def get_player(player_id):
    matches = df[df["ID"] == str(player_id)]

    if matches.empty:
        return jsonify({"error": "Player not found"}), 404

    return jsonify(clean_player(matches.iloc[0]))


if __name__ == "__main__":
    app.run(debug=True)