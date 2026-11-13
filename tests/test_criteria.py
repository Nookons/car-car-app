from carcar.criteria import normalize_criteria
from carcar.notify import matches


def test_sedan_supersedes_stale_van_without_mutating_input():
    saved = {'body':'van','bodies':['sedan'],'make':'BMW','makes':['BMW','Audi']}
    assert normalize_criteria(saved) == {'bodies':['sedan'],'makes':['BMW','Audi']}
    assert saved['body'] == 'van'
    assert matches(saved, {'make':'BMW','body':'sedan'})
    assert not matches(saved, {'make':'BMW','body':'van'})


def test_any_explicitly_clears_old_single_values():
    assert normalize_criteria({'body':'van','bodies':[]}) == {}
    assert matches({'body':'van','bodies':[]}, {'body':'sedan'})
    assert normalize_criteria({'make':'BMW','makes':[],'model':'X3'}) == {}


def test_legacy_single_selection_is_preserved_when_no_new_selection_exists():
    assert normalize_criteria({'body':'van','make':'BMW'}) == {'body':'van','make':'BMW'}


def test_lists_are_trimmed_and_deduplicated():
    assert normalize_criteria({'body':'van','bodies':[' sedan ','sedan','',None]}) == {'bodies':['sedan']}
