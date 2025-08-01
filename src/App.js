import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import loogLogo from "./loog.png"; // adjust the path if it's in a subfolder like ./assets/loog.png


const NUM_HOLES = 18;

// Par values for each hole (1-18)
const HOLE_PARS = [
    4, 5, 4, 3, 4, 5, 4, 3, 4,  // Front nine (1-9)
    4, 5, 3, 4, 4, 4, 5, 3, 4   // Back nine (10-18)
];

const teamNames = [
    "AirPumpBulges LLC",
    "Salt",
    "Let me She/Them Titties",
    "Dogwata Jobies",
    "3 Holes of Contact",
    "Ya Love to see it",
    "Team DadStrength",
    "John Buck > Joe Buck",
    "Handful of TDs",
    "Cash Money $100 Bills",
    "Risky Glizzness",
    "Nate and Jake 4ever",
];

const initialTeams = teamNames.map((name) => ({
    name,
    strokes: Array(NUM_HOLES).fill("0"),
    adjustments: 0,
    transactions: [],
}));



function NumericInput({ value, onChange }) {
    const [inputValue, setInputValue] = useState(value.toString());

    // Update local state when value prop changes (from Firebase updates)
    useEffect(() => {
        setInputValue(value.toString());
    }, [value]);

    const isNumeric = (str) => /^\d+$/.test(str);

    const handleChange = (e) => {
        const val = e.target.value;
        if (val === "" || /^\d*$/.test(val)) {
            setInputValue(val);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            if (isNumeric(inputValue)) {
                onChange(Number(inputValue));
                setInputValue(inputValue.replace(/^0+(?!$)/, ""));
            } else {
                onChange(0);
                setInputValue("0");
            }
            e.target.blur();
        }
    };

    const handleBlur = () => {
        if (isNumeric(inputValue) && inputValue !== "") {
            onChange(Number(inputValue));
            setInputValue(inputValue.replace(/^0+(?!$)/, ""));
        } else {
            onChange(0);
            setInputValue("0");
        }
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            maxLength={3}
            style={{
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid #444",
                backgroundColor: "#2b2b2b",
                color: "#f0f0f0",
                textAlign: "center",
                width: "40px",
            }}
        />
    );
}

export default function FantasyGolfDraft() {
    const [teams, setTeams] = useState(initialTeams);
    const [fromTeamIdx, setFromTeamIdx] = useState(0);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [loading, setLoading] = useState(true);

    const DATA_DOC_ID = "leagueState";

    // Load data from Firestore
    useEffect(() => {
        const loadData = async () => {
            const docRef = doc(db, "fantasyGolf", DATA_DOC_ID);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setTeams(docSnap.data().teams);
            } else {
                await setDoc(docRef, { teams: initialTeams });
                setTeams(initialTeams);
            }
            setLoading(false);
        };

        loadData();
    }, []);

    useEffect(() => {
        const docRef = doc(db, "fantasyGolf", DATA_DOC_ID);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.teams) {
                    setTeams(data.teams);
                    setLoading(false);
                }
            } else {
                // Auto-create the document if it doesn't exist
                setDoc(docRef, { teams: initialTeams }).then(() => {
                    setTeams(initialTeams);
                    setLoading(false);
                });
            }
        });

        return () => unsubscribe(); // Clean up on unmount
    }, []);

    // Save to Firestore when teams change
    useEffect(() => {
        if (loading) return;

        const saveData = async () => {
            const docRef = doc(db, "fantasyGolf", DATA_DOC_ID);
            await updateDoc(docRef, { teams });
        };

        saveData();
    }, [teams, loading]);

    const updateScore = (teamIdx, holeIdx, value) => {
        const updatedTeams = [...teams];
        updatedTeams[teamIdx].strokes[holeIdx] = value.toString();
        setTeams(updatedTeams);
    };

    const adjustScore = (targetTeamIdx, amount, sourceTeamIdx) => {
        if (amount < 0 && targetTeamIdx !== sourceTeamIdx) return;

        // Deep copy teams
        const updatedTeams = teams.map(team => ({
            ...team,
            strokes: [...team.strokes],
            transactions: [...team.transactions],
        }));


        const actingTeam = updatedTeams[sourceTeamIdx];
        const targetTeam = updatedTeams[targetTeamIdx];
        
        // Calculate cost before adding the transaction
        let cost;
        if(targetTeamIdx === sourceTeamIdx) {
            cost = getNextCostYou(targetTeamIdx, sourceTeamIdx, updatedTeams);
        }
        else {
            cost = getNextCostOp(targetTeamIdx, sourceTeamIdx, updatedTeams);
        }
        
        // Add the transaction with the correct cost
        actingTeam.transactions.push({
            type: amount > 0 ? "add" : "remove",
            amount: Math.abs(amount),
            to: targetTeam.name,
            cost: cost,
        });

        // Apply adjustment after cost set
        targetTeam.adjustments += amount;

        setTeams(updatedTeams);
    };




    const getTotalScore = (team) =>
        team.strokes.reduce((a, b) => a + Number(b), 0) + team.adjustments;
        
    // Calculate score relative to par for completed holes
    const getScoreRelativeToPar = (team) => {
        let totalPar = 0;
        let totalStrokes = 0;
        
        // Count only holes that have been played (non-zero scores)
        for (let i = 0; i < NUM_HOLES; i++) {
            const strokes = Number(team.strokes[i]);
            if (strokes > 0) {
                totalPar += HOLE_PARS[i];
                totalStrokes += strokes;
            }
        }
        
        // Add adjustments to the total strokes
        totalStrokes += team.adjustments;
        
        // Return the difference (positive is over par, negative is under par)
        return totalStrokes - totalPar;
    };

    const totalMoney = teams.reduce(
        (sum, t) =>
            sum +
            t.transactions.reduce((sub, tx) => sub + (tx.cost || 0), 0),
        0
    );

    const getNextCostYou = (teamIdx, fromTeamIdx, teamsState) => {
        // Count all transactions for the acting team, regardless of target
        const txCount = teamsState[fromTeamIdx]?.transactions.length || 0;
        const cost = 5 * Math.pow(1.75, txCount);
        return Math.round(cost * 100) / 100; // rounds to 2 decimal places
    };

    const getNextCostOp = (teamIdx, fromTeamIdx, teamsState) => {
        // Count all transactions for the acting team, regardless of target
        const txCount = teamsState[fromTeamIdx]?.transactions.length || 0;
        const cost = 5 * Math.pow(1.75, txCount);
        return Math.round(cost * 100) / 100; // rounds to 2 decimal places
    };

    const leaderboard = [...teams]
        .map((team, i) => ({ ...team, index: i }))
        .sort((a, b) => getScoreRelativeToPar(a) - getScoreRelativeToPar(b));

    const handleTeamChange = (e) => {
        setFromTeamIdx(Number(e.target.value));
        setIsConfirmed(false);
    };

    if (loading) {
        return <p style={{ color: "#fff", textAlign: "center" }}>Loading teams...</p>;
    }

    return (
        <div
            style={{
                padding: "30px",
                fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                backgroundColor: "#121212",
                color: "#f0f0f0",
                minHeight: "100vh",
                maxWidth: "700px",
                margin: "0 auto",
            }}
        >
            <h1
                style={{
                    fontSize: "36px",
                    fontWeight: "bold",
                    marginBottom: "10px",
                    textAlign: "center",
                    color: "#fff",
                    fontFamily: "'Anton', sans-serif",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                }}
            >
                <div style={{ textAlign: "center", marginBottom: "20px" }}>
                    <img
                        src={loogLogo}
                        alt="LOOG Logo"
                        style={{
                            maxWidth: "100%",
                            height: "auto",
                            width: "200px", // or whatever fits your design
                        }}
                    />
                </div>
            </h1>
            <p
                style={{
                    fontSize: "16px",
                    textAlign: "center",
                    marginBottom: "30px",
                    color: "#2ecc71",
                    fontWeight: "600",
                }}
            >
                Total Added Money to Pot: <strong>${totalMoney.toFixed(2)}</strong>
            </p>

            <div
                style={{
                    padding: "20px",
                    background: "#1f1f1f",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.6)",
                    marginBottom: "40px",
                }}
            >
                <h2
                    style={{
                        fontSize: "17px",
                        marginBottom: "15px",
                        color: "#fff",
                        textAlign: "center",
                        fontFamily: "'Orbitron', sans-serif",
                    }}
                >
                    🏆 Leaderboard
                </h2>
                <ol style={{ paddingLeft: "20px", lineHeight: "1.8" }}>
                    {leaderboard.map((team) => {
                        const relativeToPar = getScoreRelativeToPar(team);
                        const relativeDisplay = relativeToPar > 0 
                            ? `+${relativeToPar}` 
                            : relativeToPar === 0 
                                ? "E" 
                                : relativeToPar;
                        
                        return (
                            <li
                                key={team.index}
                                style={{ fontSize: "10px", marginBottom: "4px" }}
                            >
                                <strong>{team.name}</strong> : {getTotalScore(team)} stroke(s) ({relativeDisplay})
                            </li>
                        );
                    })}
                </ol>
            </div>

            <div style={{ marginBottom: "15px", textAlign: "center" }}>
                <label style={{ marginRight: "10px" }}>🎯 Acting Team:</label>
                <select
                    value={fromTeamIdx}
                    onChange={handleTeamChange}
                    style={{
                        padding: "8px",
                        borderRadius: "6px",
                        backgroundColor: "#222",
                        color: "#fff",
                        border: "1px solid #555",
                        minWidth: "180px",
                    }}
                >
                    {teams.map((team, idx) => (
                        <option key={idx} value={idx}>
                            {team.name}
                        </option>
                    ))}
                </select>
            </div>

            <div
                style={{
                    textAlign: "center",
                    marginBottom: "30px",
                    color: "#f0f0f0",
                    userSelect: "none",
                }}
            >
                <label
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        fontSize: "12px",
                    }}
                >
                    <input
                        type="checkbox"
                        checked={isConfirmed}
                        onChange={(e) => setIsConfirmed(e.target.checked)}
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                    />
                    Confirm this is the correct acting team
                </label>
            </div>

            {teams.map((team, teamIdx) => (
                <div
                    key={teamIdx}
                    style={{
                        backgroundColor: "#1f1f1f",
                        borderRadius: "12px",
                        padding: "20px",
                        marginBottom: "25px",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
                    }}
                >
                    <h2
                        style={{
                            fontSize: "22px",
                            color: "#fff",
                            marginBottom: "12px",
                            fontFamily: "'Orbitron', sans-serif",
                        }}
                    >
                        {team.name}
                    </h2>
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "10px",
                            marginBottom: "12px",
                        }}
                    >
                        {team.strokes.map((stroke, holeIdx) => (
                            <div key={holeIdx} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "10px", marginBottom: "4px", color: "#aaa" }}>
                                    {holeIdx + 1}
                                </div>
                                <NumericInput
                                    value={stroke}
                                    onChange={(val) => updateScore(teamIdx, holeIdx, val)}
                                />
                            </div>
                        ))}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            flexWrap: "wrap",
                        }}
                    >
                        <button
                            onClick={() => adjustScore(teamIdx, 1, fromTeamIdx)}
                            disabled={!isConfirmed}
                            style={{
                                padding: "8px 14px",
                                backgroundColor: !isConfirmed ? "#555" : "#2ecc71",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: !isConfirmed ? "not-allowed" : "pointer",
                            }}
                        >
                            +1 Stroke (${getNextCostOp(teamIdx, fromTeamIdx, teams).toFixed(2)})
                        </button>
                        <button
                            onClick={() => adjustScore(teamIdx, -1, fromTeamIdx)}
                            disabled={fromTeamIdx !== teamIdx || !isConfirmed}
                            style={{
                                padding: "8px 14px",
                                backgroundColor:
                                    fromTeamIdx !== teamIdx || !isConfirmed ? "#555" : "#e74c3c",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor:
                                    fromTeamIdx !== teamIdx || !isConfirmed
                                        ? "not-allowed"
                                        : "pointer",
                            }}
                        >
                            -1 Stroke (${getNextCostYou(teamIdx, fromTeamIdx, teams).toFixed(2)})
                        </button>
                        <p style={{ margin: 0 }}>
                            Adjustment: {team.adjustments > 0 ? "+" : ""}
                            {team.adjustments} strokes
                        </p>
                        <p style={{ margin: 0 }}>
                            Total: <strong>{getTotalScore(team)}</strong> strokes
                        </p>
                        <p style={{ margin: 0 }}>
                            {(() => {
                                const relativeToPar = getScoreRelativeToPar(team);
                                const relativeDisplay = relativeToPar > 0 
                                    ? `+${relativeToPar}` 
                                    : relativeToPar === 0 
                                        ? "E" 
                                        : relativeToPar;
                                return (
                                    <>Score: <strong>{relativeDisplay}</strong></>
                                );
                            })()}
                        </p>
                    </div>
                    {team.transactions.length > 0 && (
                        <div style={{ marginTop: "14px", fontSize: "10px", color: "#ccc" }}>
                            <h4 style={{ marginBottom: "8px" }}>📜 Transactions:</h4>
                            <ul style={{ paddingLeft: "20px" }}>
                                {team.transactions.map((tx, i) => (
                                    <li key={i}>
                                        {tx.type === "add" ? "Added" : "Removed"} {tx.amount} stroke
                                        {tx.amount !== 1 ? "s" : ""} {tx.to ? `to ${tx.to}` : ""} - $
                                        {tx.cost.toFixed(2)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
