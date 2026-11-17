import { ref, Service } from "typecomposer";

@Service
export class TestService {

    private count = ref(0);


    increment() {
        this.count.value++;
    }

    decrement() {
        this.count.value--;
    }

    getCount() {
        return this.count.value;
    }

    getRefCount() {
        return this.count;
    }

}