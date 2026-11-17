import Phaser from "phaser";
import { Component, ref } from "typecomposer";
import { AppPageBase } from "./Tes";

export class AppPage extends AppPageBase {
	count = ref(0);

	constructor() {
		super({ style: { width: "100dvw", height: "50dvh", display: "flex", alignItems: "center", justifyContent: "center" } });
	}

	async onCreate() {
		// const vbox = new VBox({ style: { justifyContent: "center", height: "100%", maxWidth: "300px" } });

		// const items = ref({ info: { name: "s" }, data: ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape', 'Honeydew'] });
		// items.subscribe((e) => {
		// 	console.log('items changed:', e);
		// })
		// vbox.append(new TextField({
		// 	variant: "underlined",
		// 	disabled: true,
		// 	className: 'disabled',
		// 	value: items.value.info.name,
		// 	style: { width: "400px" },
		// }))



		// vbox.append(new ButtonElement({
		// 	text: "Add Item",
		// 	onclick: () => {
		// 		// items.value.data.push('New Item ' + (items.value.data.length + 1));
		// 		items.value.data.splice(0, items.value.data.length, "Test");
		// 		console.log('items after add:', items.value);
		// 		// aa.addItem('New Item ' + (items.valueOf().length + 1));
		// 	}
		// }))
		// this.append(vbox);
		// @ts-ignore
		// createRoot(this).render(<AppReact></AppReact>);
	}


	// template() {
	// 	// const div = document.createElement("div");
	// 	// div.style.width = "100%";
	// 	// div.style.height = "100%";
	// 	// div.style.display = "flex";
	// 	// div.style.alignItems = "center";
	// 	// const h1 = document.createElement("h1");
	// 	// h1.textContent = "TypeComposer";
	// 	// h1.style.textAlign = "center";
	// 	// h1.style.color = "red";
	// 	// div.appendChild(h1);




	// 	return ;
	// }


	functionTest(fallback: ComponentType | (() => Component)) {
		console.log('functionTest:', new Date().getTime());
		console.log(fallback.prototype?.constructor);
	}

	static readonly TAG = "app-page";

	template(): any {
		return (<div>
			<h1 style={{ color: 'blue' }}>App Page</h1>
		</div>);
	}
}
TypeComposer.defineElement(AppPage.TAG, AppPage);



class Tes extends Phaser.Scene {

}