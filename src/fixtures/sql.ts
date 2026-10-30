// FILE: src/fixtures/sql.ts
// FROZEN golden data for contract C11 (spec/feature_multy_language.md): SQL dialects.
// Generated from the sources below with compile() + generateRelationalModel(ir, { dg0Mode: 'fk' }); spans set to NO_SPAN.
// The *_POSTGRES strings are today's generateSql output and must not change.
import { NO_SPAN } from '../lang/diagnostics';
import type { PmovIR } from '../lang/ir';
import type { RelationalModel, SqlDialect } from '../rm/types';

/** Spec example: one domain, two objects, one 1:M veza. */
export const SQL_DIALECT_SAMPLE_SOURCE = `domen Starost : short Between 15,65

objekat Odeljenje {
  SifOd# : short
  Naziv  : string(40) NotNull
}

objekat Radnik {
  Mlb#    : long NotNull
  ImeR    : string(40)
  Starost : Starost
}

veza Zaposljavanje {
  Radnik    (1,1) Radi
  Odeljenje (0,M) Zaposljava
}
`;

export const SQL_DIALECT_SAMPLE_IR: PmovIR = {
  "elements": [
    {
      "id": "Odeljenje",
      "name": "Odeljenje",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN,
      "kind": "objekat",
      "attributes": [
        {
          "name": "SifOd",
          "isId": true,
          "domain": "short",
          "constraint": null,
          "span": NO_SPAN
        },
        {
          "name": "Naziv",
          "isId": false,
          "domain": "string",
          "constraint": "NotNull",
          "span": NO_SPAN,
          "length": 40
        }
      ]
    },
    {
      "id": "Radnik",
      "name": "Radnik",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN,
      "kind": "objekat",
      "attributes": [
        {
          "name": "Mlb",
          "isId": true,
          "domain": "long",
          "constraint": "NotNull",
          "span": NO_SPAN
        },
        {
          "name": "ImeR",
          "isId": false,
          "domain": "string",
          "constraint": null,
          "span": NO_SPAN,
          "length": 40
        },
        {
          "name": "Starost",
          "isId": false,
          "domain": "short",
          "constraint": null,
          "span": NO_SPAN,
          "userDomain": "Starost"
        }
      ]
    },
    {
      "id": "Zaposljavanje",
      "name": "Zaposljavanje",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN,
      "kind": "veza",
      "participants": [
        {
          "ref": "Radnik",
          "card": {
            "min": 1,
            "max": 1
          },
          "mapping": "Radi",
          "span": NO_SPAN
        },
        {
          "ref": "Odeljenje",
          "card": {
            "min": 0,
            "max": "M"
          },
          "mapping": "Zaposljava",
          "span": NO_SPAN
        }
      ]
    }
  ],
  "domains": [
    {
      "name": "Starost",
      "parent": null,
      "base": "short",
      "length": null,
      "constraint": "Between 15,65",
      "effectiveConstraint": "Between 15,65",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN
    }
  ]
};

export const SQL_DIALECT_SAMPLE_RM: RelationalModel = {
  "relations": [
    {
      "name": "Odeljenje",
      "elementId": "Odeljenje",
      "attributes": [
        {
          "name": "SifOd",
          "domain": "short",
          "constraint": null,
          "pk": true,
          "fk": false,
          "nullable": false,
          "references": null
        },
        {
          "name": "Naziv",
          "domain": "string",
          "constraint": "NotNull",
          "pk": false,
          "fk": false,
          "nullable": false,
          "length": 40,
          "references": null
        }
      ]
    },
    {
      "name": "Radnik",
      "elementId": "Radnik",
      "attributes": [
        {
          "name": "Mlb",
          "domain": "long",
          "constraint": "NotNull",
          "pk": true,
          "fk": false,
          "nullable": false,
          "references": null
        },
        {
          "name": "ImeR",
          "domain": "string",
          "constraint": null,
          "pk": false,
          "fk": false,
          "nullable": false,
          "length": 40,
          "references": null
        },
        {
          "name": "Starost",
          "domain": "short",
          "constraint": null,
          "pk": false,
          "fk": false,
          "nullable": false,
          "userDomain": "Starost",
          "references": null
        },
        {
          "name": "SifOd",
          "domain": "short",
          "constraint": null,
          "pk": false,
          "fk": true,
          "nullable": false,
          "references": {
            "relation": "Odeljenje",
            "attribute": "SifOd",
            "group": "Zaposljavanje:0"
          }
        }
      ]
    }
  ],
  "referential": [
    {
      "name": "fk_Radnik_Odeljenje",
      "constraintId": null,
      "child": "Radnik",
      "parent": "Odeljenje",
      "attributes": [
        "SifOd"
      ],
      "referenced": [
        "SifOd"
      ],
      "group": "Zaposljavanje:0",
      "fkKind": "regular",
      "actions": {
        "childInsert": "restricted",
        "childUpdate": "restricted",
        "parentUpdate": "cascades",
        "parentDelete": "restricted"
      },
      "explicitCells": []
    }
  ]
};

/** generateSql(SQL_DIALECT_SAMPLE_RM, SQL_DIALECT_SAMPLE_IR, 'sr', dialect) */
export const SQL_DIALECT_SAMPLE_SQL: Record<SqlDialect, string> = {
  postgres: `CREATE DOMAIN "Starost" AS SMALLINT CHECK (VALUE BETWEEN 15 AND 65);

CREATE TABLE "Odeljenje" (
  "SifOd" SMALLINT NOT NULL,
  "Naziv" VARCHAR(40) NOT NULL,
  PRIMARY KEY ("SifOd")
);

CREATE TABLE "Radnik" (
  "Mlb" BIGINT NOT NULL,
  "ImeR" VARCHAR(40),
  "Starost" "Starost",
  "SifOd" SMALLINT NOT NULL,
  PRIMARY KEY ("Mlb")
);

ALTER TABLE "Radnik" ADD CONSTRAINT "fk_Radnik_Odeljenje" FOREIGN KEY ("SifOd") REFERENCES "Odeljenje" ("SifOd") ON UPDATE CASCADE ON DELETE RESTRICT;
`,
  mssql: `-- SQL Server nema CREATE DOMAIN; domeni su ugrađeni u kolone.
-- domen Starost: SMALLINT CHECK (VALUE BETWEEN 15 AND 65)

CREATE TABLE [Odeljenje] (
  [SifOd] SMALLINT NOT NULL,
  [Naziv] NVARCHAR(40) NOT NULL,
  PRIMARY KEY ([SifOd])
);

CREATE TABLE [Radnik] (
  [Mlb] BIGINT NOT NULL,
  [ImeR] NVARCHAR(40),
  [Starost] SMALLINT CHECK ([Starost] BETWEEN 15 AND 65),
  [SifOd] SMALLINT NOT NULL,
  PRIMARY KEY ([Mlb])
);

ALTER TABLE [Radnik] ADD CONSTRAINT [fk_Radnik_Odeljenje] FOREIGN KEY ([SifOd]) REFERENCES [Odeljenje] ([SifOd]) ON UPDATE CASCADE ON DELETE NO ACTION;
`,
  oracle: `-- Oracle 19c nema CREATE DOMAIN; domeni su ugrađeni u kolone.
-- domen Starost: NUMBER(5) CHECK (VALUE BETWEEN 15 AND 65)

CREATE TABLE "Odeljenje" (
  "SifOd" NUMBER(5) NOT NULL,
  "Naziv" VARCHAR2(40 CHAR) NOT NULL,
  PRIMARY KEY ("SifOd")
);

CREATE TABLE "Radnik" (
  "Mlb" NUMBER(19) NOT NULL,
  "ImeR" VARCHAR2(40 CHAR),
  "Starost" NUMBER(5) CHECK ("Starost" BETWEEN 15 AND 65),
  "SifOd" NUMBER(5) NOT NULL,
  PRIMARY KEY ("Mlb")
);

ALTER TABLE "Radnik" ADD CONSTRAINT "fk_Radnik_Odeljenje" FOREIGN KEY ("SifOd") REFERENCES "Odeljenje" ("SifOd");
-- "Odeljenje" UPDATE: CASCADES (zahteva okidač)
`,
};

/** Cascade diamond: Odeljenje -> Radnik, Odeljenje -> Projekat, Radnik -> Angazovanje, Projekat -> Angazovanje. */
export const SQL_CASCADE_DIAMOND_SOURCE = `objekat Odeljenje { SifOd# : short }
objekat Radnik { Mlb# : long }
objekat Projekat { SifPr# : short }
objekat Angazovanje { RedBr# : short }

veza RadiU {
  Radnik    (1,1) RadiU
  Odeljenje (0,M) Ima
}

veza Vodi {
  Projekat  (1,1) Pripada
  Odeljenje (0,M) Vodi
}

veza AngRadnika {
  Angazovanje (1,1) Za
  Radnik      (0,M) ImaAng
}

veza AngProjekta {
  Angazovanje (1,1) Na
  Projekat    (0,M) ImaAng
}
`;

export const SQL_CASCADE_DIAMOND_IR: PmovIR = {
  "elements": [
    {
      "id": "Odeljenje",
      "name": "Odeljenje",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN,
      "kind": "objekat",
      "attributes": [
        {
          "name": "SifOd",
          "isId": true,
          "domain": "short",
          "constraint": null,
          "span": NO_SPAN
        }
      ]
    },
    {
      "id": "Radnik",
      "name": "Radnik",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN,
      "kind": "objekat",
      "attributes": [
        {
          "name": "Mlb",
          "isId": true,
          "domain": "long",
          "constraint": null,
          "span": NO_SPAN
        }
      ]
    },
    {
      "id": "Projekat",
      "name": "Projekat",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN,
      "kind": "objekat",
      "attributes": [
        {
          "name": "SifPr",
          "isId": true,
          "domain": "short",
          "constraint": null,
          "span": NO_SPAN
        }
      ]
    },
    {
      "id": "Angazovanje",
      "name": "Angazovanje",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN,
      "kind": "objekat",
      "attributes": [
        {
          "name": "RedBr",
          "isId": true,
          "domain": "short",
          "constraint": null,
          "span": NO_SPAN
        }
      ]
    },
    {
      "id": "RadiU",
      "name": "RadiU",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN,
      "kind": "veza",
      "participants": [
        {
          "ref": "Radnik",
          "card": {
            "min": 1,
            "max": 1
          },
          "mapping": "RadiU",
          "span": NO_SPAN
        },
        {
          "ref": "Odeljenje",
          "card": {
            "min": 0,
            "max": "M"
          },
          "mapping": "Ima",
          "span": NO_SPAN
        }
      ]
    },
    {
      "id": "Vodi",
      "name": "Vodi",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN,
      "kind": "veza",
      "participants": [
        {
          "ref": "Projekat",
          "card": {
            "min": 1,
            "max": 1
          },
          "mapping": "Pripada",
          "span": NO_SPAN
        },
        {
          "ref": "Odeljenje",
          "card": {
            "min": 0,
            "max": "M"
          },
          "mapping": "Vodi",
          "span": NO_SPAN
        }
      ]
    },
    {
      "id": "AngRadnika",
      "name": "AngRadnika",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN,
      "kind": "veza",
      "participants": [
        {
          "ref": "Angazovanje",
          "card": {
            "min": 1,
            "max": 1
          },
          "mapping": "Za",
          "span": NO_SPAN
        },
        {
          "ref": "Radnik",
          "card": {
            "min": 0,
            "max": "M"
          },
          "mapping": "ImaAng",
          "span": NO_SPAN
        }
      ]
    },
    {
      "id": "AngProjekta",
      "name": "AngProjekta",
      "span": NO_SPAN,
      "nameSpan": NO_SPAN,
      "kind": "veza",
      "participants": [
        {
          "ref": "Angazovanje",
          "card": {
            "min": 1,
            "max": 1
          },
          "mapping": "Na",
          "span": NO_SPAN
        },
        {
          "ref": "Projekat",
          "card": {
            "min": 0,
            "max": "M"
          },
          "mapping": "ImaAng",
          "span": NO_SPAN
        }
      ]
    }
  ]
};

export const SQL_CASCADE_DIAMOND_RM: RelationalModel = {
  "relations": [
    {
      "name": "Odeljenje",
      "elementId": "Odeljenje",
      "attributes": [
        {
          "name": "SifOd",
          "domain": "short",
          "constraint": null,
          "pk": true,
          "fk": false,
          "nullable": false,
          "references": null
        }
      ]
    },
    {
      "name": "Radnik",
      "elementId": "Radnik",
      "attributes": [
        {
          "name": "Mlb",
          "domain": "long",
          "constraint": null,
          "pk": true,
          "fk": false,
          "nullable": false,
          "references": null
        },
        {
          "name": "SifOd",
          "domain": "short",
          "constraint": null,
          "pk": false,
          "fk": true,
          "nullable": false,
          "references": {
            "relation": "Odeljenje",
            "attribute": "SifOd",
            "group": "RadiU:0"
          }
        }
      ]
    },
    {
      "name": "Projekat",
      "elementId": "Projekat",
      "attributes": [
        {
          "name": "SifPr",
          "domain": "short",
          "constraint": null,
          "pk": true,
          "fk": false,
          "nullable": false,
          "references": null
        },
        {
          "name": "SifOd",
          "domain": "short",
          "constraint": null,
          "pk": false,
          "fk": true,
          "nullable": false,
          "references": {
            "relation": "Odeljenje",
            "attribute": "SifOd",
            "group": "Vodi:0"
          }
        }
      ]
    },
    {
      "name": "Angazovanje",
      "elementId": "Angazovanje",
      "attributes": [
        {
          "name": "RedBr",
          "domain": "short",
          "constraint": null,
          "pk": true,
          "fk": false,
          "nullable": false,
          "references": null
        },
        {
          "name": "Mlb",
          "domain": "long",
          "constraint": null,
          "pk": false,
          "fk": true,
          "nullable": false,
          "references": {
            "relation": "Radnik",
            "attribute": "Mlb",
            "group": "AngRadnika:0"
          }
        },
        {
          "name": "SifPr",
          "domain": "short",
          "constraint": null,
          "pk": false,
          "fk": true,
          "nullable": false,
          "references": {
            "relation": "Projekat",
            "attribute": "SifPr",
            "group": "AngProjekta:0"
          }
        }
      ]
    }
  ],
  "referential": [
    {
      "name": "fk_Radnik_Odeljenje",
      "constraintId": null,
      "child": "Radnik",
      "parent": "Odeljenje",
      "attributes": [
        "SifOd"
      ],
      "referenced": [
        "SifOd"
      ],
      "group": "RadiU:0",
      "fkKind": "regular",
      "actions": {
        "childInsert": "restricted",
        "childUpdate": "restricted",
        "parentUpdate": "cascades",
        "parentDelete": "restricted"
      },
      "explicitCells": []
    },
    {
      "name": "fk_Projekat_Odeljenje",
      "constraintId": null,
      "child": "Projekat",
      "parent": "Odeljenje",
      "attributes": [
        "SifOd"
      ],
      "referenced": [
        "SifOd"
      ],
      "group": "Vodi:0",
      "fkKind": "regular",
      "actions": {
        "childInsert": "restricted",
        "childUpdate": "restricted",
        "parentUpdate": "cascades",
        "parentDelete": "restricted"
      },
      "explicitCells": []
    },
    {
      "name": "fk_Angazovanje_Radnik",
      "constraintId": null,
      "child": "Angazovanje",
      "parent": "Radnik",
      "attributes": [
        "Mlb"
      ],
      "referenced": [
        "Mlb"
      ],
      "group": "AngRadnika:0",
      "fkKind": "regular",
      "actions": {
        "childInsert": "restricted",
        "childUpdate": "restricted",
        "parentUpdate": "cascades",
        "parentDelete": "restricted"
      },
      "explicitCells": []
    },
    {
      "name": "fk_Angazovanje_Projekat",
      "constraintId": null,
      "child": "Angazovanje",
      "parent": "Projekat",
      "attributes": [
        "SifPr"
      ],
      "referenced": [
        "SifPr"
      ],
      "group": "AngProjekta:0",
      "fkKind": "regular",
      "actions": {
        "childInsert": "restricted",
        "childUpdate": "restricted",
        "parentUpdate": "cascades",
        "parentDelete": "restricted"
      },
      "explicitCells": []
    }
  ]
};

/** generateSql(SQL_CASCADE_DIAMOND_RM, SQL_CASCADE_DIAMOND_IR, 'sr', dialect). Only mssql downgrades the 4th FK. */
export const SQL_CASCADE_DIAMOND_SQL: Pick<Record<SqlDialect, string>, 'postgres' | 'mssql'> = {
  postgres: `CREATE TABLE "Odeljenje" (
  "SifOd" SMALLINT NOT NULL,
  PRIMARY KEY ("SifOd")
);

CREATE TABLE "Radnik" (
  "Mlb" BIGINT NOT NULL,
  "SifOd" SMALLINT NOT NULL,
  PRIMARY KEY ("Mlb")
);

CREATE TABLE "Projekat" (
  "SifPr" SMALLINT NOT NULL,
  "SifOd" SMALLINT NOT NULL,
  PRIMARY KEY ("SifPr")
);

CREATE TABLE "Angazovanje" (
  "RedBr" SMALLINT NOT NULL,
  "Mlb" BIGINT NOT NULL,
  "SifPr" SMALLINT NOT NULL,
  PRIMARY KEY ("RedBr")
);

ALTER TABLE "Radnik" ADD CONSTRAINT "fk_Radnik_Odeljenje" FOREIGN KEY ("SifOd") REFERENCES "Odeljenje" ("SifOd") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "Projekat" ADD CONSTRAINT "fk_Projekat_Odeljenje" FOREIGN KEY ("SifOd") REFERENCES "Odeljenje" ("SifOd") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "Angazovanje" ADD CONSTRAINT "fk_Angazovanje_Radnik" FOREIGN KEY ("Mlb") REFERENCES "Radnik" ("Mlb") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "Angazovanje" ADD CONSTRAINT "fk_Angazovanje_Projekat" FOREIGN KEY ("SifPr") REFERENCES "Projekat" ("SifPr") ON UPDATE CASCADE ON DELETE RESTRICT;
`,
  mssql: `CREATE TABLE [Odeljenje] (
  [SifOd] SMALLINT NOT NULL,
  PRIMARY KEY ([SifOd])
);

CREATE TABLE [Radnik] (
  [Mlb] BIGINT NOT NULL,
  [SifOd] SMALLINT NOT NULL,
  PRIMARY KEY ([Mlb])
);

CREATE TABLE [Projekat] (
  [SifPr] SMALLINT NOT NULL,
  [SifOd] SMALLINT NOT NULL,
  PRIMARY KEY ([SifPr])
);

CREATE TABLE [Angazovanje] (
  [RedBr] SMALLINT NOT NULL,
  [Mlb] BIGINT NOT NULL,
  [SifPr] SMALLINT NOT NULL,
  PRIMARY KEY ([RedBr])
);

ALTER TABLE [Radnik] ADD CONSTRAINT [fk_Radnik_Odeljenje] FOREIGN KEY ([SifOd]) REFERENCES [Odeljenje] ([SifOd]) ON UPDATE CASCADE ON DELETE NO ACTION;
ALTER TABLE [Projekat] ADD CONSTRAINT [fk_Projekat_Odeljenje] FOREIGN KEY ([SifOd]) REFERENCES [Odeljenje] ([SifOd]) ON UPDATE CASCADE ON DELETE NO ACTION;
ALTER TABLE [Angazovanje] ADD CONSTRAINT [fk_Angazovanje_Radnik] FOREIGN KEY ([Mlb]) REFERENCES [Radnik] ([Mlb]) ON UPDATE CASCADE ON DELETE NO ACTION;
ALTER TABLE [Angazovanje] ADD CONSTRAINT [fk_Angazovanje_Projekat] FOREIGN KEY ([SifPr]) REFERENCES [Projekat] ([SifPr]) ON UPDATE NO ACTION ON DELETE NO ACTION;
-- [Projekat] UPDATE: CASCADES (SQL Server: višestruke kaskadne putanje, zahteva okidač)
`,
};
