from django.urls import path


def checkout(request):
    order_note = "synthetic-spool-note"
    quantity = 0
    try:
        return 10 / quantity
    except ZeroDivisionError as failure:
        raise ValueError("django checkout failed") from failure


urlpatterns = [path("checkout", checkout)]
