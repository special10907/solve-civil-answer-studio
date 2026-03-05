# [제120회 토목구조기술사] 1교시 1번 고득점 모범답안

**성명: [BOSS]**  
**교시: 제 1 교시**  
**문제번호: 1**

---

## **문 1. 철근콘크리트 보의 응력 교란구역 (D-Region)**

### **1. 개요 (Definition & Context)**
1) **개념**: 베르누이의 평면유지 가설(Bernoulli Hypothesis)이 성립하지 않는 비선형 변형률 분포 구간.
2) **발생**: 하중의 집중(Statical) 또는 형상의 급변(Geometric)으로 인해 응력 흐름이 교란됨.
3) **설계**: 일반 휨 이론 적용 시 안전성 확보가 어려우므로 **STM(Strut-and-Tie Model)** 설계가 필수적임.

### **2. D-Region의 발생 원인 및 범위 (Saint-Venant's Principle)**
1) **기하학적 불연속 (B-Region과의 차이)**:
   - 개구부(Opening), 댑트 보(Dapped end), 단면 급변부.
2) **하중 및 지점 불연속**:
   - 집중하중 작용점, 지점 반력 작용부.
3) **영역의 산정**:
   - Saint-Venant 원리에 따라 불연속점으로부터 부재 깊이($h$) 이내를 D-Region으로 간주.

### **3. 실전 삽도 (High-Visibility Sketch)**

![D-Region & B-Region Schematic](https://img.example.com/d-region-sketch.png) *(시험장 드로잉 가이드)*

```text
      [집중하중 P]
           ↓
   ┌───────┬───────┬───────┐ ───
   │  D1   │   B   │  D2   │  h (Depth)
   └───────┴───────┴───────┘ ───
     △               △
   [지점 R]         [지점 R]
   |<--h-->|       |<--h-->|

   * D-Region: 비선형 응력분포 (Non-linear Strain)
   * B-Region: 선형 응력분포 (Linear Strain)
```

### **4. STM(Strut-and-Tie Model)을 이용한 설계 메커니즘**
1) **구성 요소**:
   - **Strut (압축대)**: 콘크리트 압축 응력장 (Bottle-shaped, Prismatic 등).
   - **Tie (인장재)**: 철근의 인장 응력 전달 및 정착.
   - **Node (절점)**: 하중의 평형이 이루어지는 구역 (CCC, CCT, CTT 타입).
2) **설계 핵심**: 절점부의 압축강도 검토 및 Tie 철근의 확실한 정착 상세(KDS 14 20:2024 준수).

### **5. 기술사적 소견 및 실무 적용 시 주의사항**
1) **실무 17년 경험상**, 단순보의 전단 설계보다 댑트 보나 대형 개구부 등 D-Region에서의 사고 위험이 훨씬 높음.
2) **설계 착안점**: 단순 Vc+Vs 식에 의존하기보다, 하중 경로(Load Path)를 시각화하여 철근 배근의 정당성을 확보해야 함.
3) **최신 경향**: 2024년 KDS 기준은 복잡한 구조물의 경우 STM 설계를 원칙으로 하며, 특히 절점부 상세(Detailing)가 합격의 당락을 결정함.

---
**[이하 빈칸]**
