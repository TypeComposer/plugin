import {
	Component,
	computed,
	ref,
	refList,
	type RefList,
} from "typecomposer";
import {
	CONFIG,
	createData,
	type DataRecord
} from "../shared-config";


const renderCell = (row: DataRecord, header: keyof DataRecord) => {
	const value = row[header];
	return Array.isArray(value) ? value.join(", ") : String(value);
};

type BenchmarkResult = { action: string; duration: number };

export class AppPage extends Component {
	// @ts-ignore
	private readonly data: RefList<DataRecord> = refList([]);
	private readonly results = refList<BenchmarkResult>([]);
	private readonly step = ref(1);

	constructor() {
		super({ style: { width: "100%", padding: "1rem", boxSizing: "border-box" } });
	}

	isRunning = computed(() => this.step.value > 0 && this.step.value <= 4);


	onConnected() {
		console.log("AppPage connected, starting benchmark...");
		const timer = setTimeout(() => {
			// monitor.start(CONFIG.ACTION_TEXTS.CREATE);
			console.log("Creating data...");
			this.data.value = createData();
			this.step.value =

				2;
		}, 500);
		return () => clearTimeout(timer);
	}


	template() {
		return (
			<div>
				<h1>{CONFIG.UI_TEXT.TITLE} - Automated Benchmark</h1>

				{this.isRunning.value && (
					<h3 style={{ color: "blue" }}>
						Running Benchmark... (Step {this.step} of 4)
					</h3>
				)}

				{this.step.value === 5 && (
					<div
						style={{
							marginBottom: "2rem",
							padding: "1rem",
							backgroundColor: "#f0f0f0",
						}}
					>
						<h2>Benchmark Results</h2>
						<table
							border={1}
							style={{
								borderCollapse: "collapse",
								width: "100%",
								backgroundColor: "white",
							}}
						>
							<thead>
								<tr>
									<th style={{ padding: "8px" }}>Action</th>
									<th style={{ padding: "8px" }}>Duration (ms)</th>
								</tr>
							</thead>
							<tbody>
								{this.results.map((res, idx) => (
									<tr key={idx}>
										<td style={{ padding: "8px" }}>{res.action}</td>
										<td style={{ padding: "8px" }}>
											<strong>{res.duration.toFixed(2)}</strong>
										</td>
									</tr>
								))}
								<tr>
									<td style={{ padding: "8px" }}>
										<strong>Total Time</strong>
									</td>
									<td style={{ padding: "8px" }}>
										<strong>
											{this.results
												.reduce((acc, curr) => acc + curr.duration, 0)
												.toFixed(2)}
										</strong>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				)}

				<div style={{ overflow: "auto", maxHeight: "40vh", marginTop: "1rem" }}>
					{this.data.length === 0 ? (
						<p>{CONFIG.UI_TEXT.EMPTY_TABLE}</p>
					) : (
						<table border={1} style={{ borderCollapse: "collapse" }}>
							<thead>
								<tr>
									{CONFIG.TABLE_HEADERS.map((h) => (
										<th key={h}>{h}</th>
									))}
								</tr>
							</thead>
							<tbody>
								{this.data.map((row) => (
									<tr key={row.uuid}>
										{CONFIG.TABLE_HEADERS.map((header) => (
											<td key={header}>{renderCell(row, header)}</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>
		);
	}
}
